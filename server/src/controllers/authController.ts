import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { signToken } from '../utils/jwt';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie';
import { hashPassword, verifyPassword } from '../utils/password';
import { getPasswordValidationError } from '../utils/passwordPolicy';
import { normalizeRegistrationEmail, normalizeRegistrationPersonName } from '../utils/registrationValidation';
import {
  EmailDeliveryConfigurationError,
  getEmailVerificationConfig,
  getEmailVerificationExpiry,
  sendVerificationEmail,
} from '../services/emailVerificationService';
import { createError } from '../middleware/errorHandler';
import type { EmailVerificationToken, Prisma } from '@prisma/client';

const meaningfulTextPattern = /^[\p{N}\p{P}\p{S}\p{Zs}\s]+$/u;
const LOGIN_DATABASE_ERROR_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1010', 'P1017', 'P2021', 'P2022', 'P2024']);

const getLoginDatabaseErrorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' && LOGIN_DATABASE_ERROR_CODES.has(code) ? code : null;
};

const validateInstitutionName = (value: unknown, label: string): string => {
  if (typeof value !== 'string') {
    throw createError(`${label} must be text.`, 400);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw createError(`${label} is required.`, 400);
  }
  if (trimmed.length > 160) {
    throw createError(`${label} must be between 1 and 160 characters.`, 400);
  }
  if (!/[\p{L}\p{N}]/u.test(trimmed) || meaningfulTextPattern.test(trimmed)) {
    throw createError(`${label} must include at least one letter or number.`, 400);
  }

  return trimmed;
};

const createEmailVerificationToken = async (
  database: Prisma.TransactionClient,
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<EmailVerificationToken> => database.emailVerificationToken.create({
  data: { userId, tokenHash, expiresAt },
});

const logEmailDeliveryFailure = (error: unknown, action: string): void => {
  const errorCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : 'unclassified';
  console.error(`[email-verification] ${action} delivery failed.`, { errorCode });
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, firstName, lastName, role = 'STUDENT', university, companyName } = req.body;

    let normalizedEmail: string;
    let normalizedFirstName: string;
    let normalizedLastName: string;
    try {
      normalizedEmail = normalizeRegistrationEmail(email, role);
      normalizedFirstName = normalizeRegistrationPersonName(firstName, 'First name');
      normalizedLastName = normalizeRegistrationPersonName(lastName, 'Last name');
    } catch (error) {
      return next(createError(error instanceof Error ? error.message : 'Registration data is invalid.', 400));
    }
    const normalizedUniversity = role === 'EMPLOYER' || university === undefined
      ? ''
      : validateInstitutionName(university, 'University');
    const normalizedCompanyName = role === 'EMPLOYER' ? validateInstitutionName(companyName, 'Company name') : '';

    if (!normalizedEmail || typeof password !== 'string') {
      return next(createError('Email and password are required.', 400));
    }

    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      return next(createError(passwordError, 400));
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return next(createError('An account with this email already exists.', 409));
    }

    if (role === 'EMPLOYER') {
      try {
        getEmailVerificationConfig();
      } catch (error) {
        if (error instanceof EmailDeliveryConfigurationError) {
          res.status(503).json({
            success: false,
            code: 'EMAIL_DELIVERY_NOT_CONFIGURED',
            message: error.message,
          });
          return;
        }
        throw error;
      }
    }

    const hashedPassword = await hashPassword(password);

    const rawVerificationToken = role === 'EMPLOYER' ? crypto.randomBytes(32).toString('hex') : undefined;
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          role: role === 'EMPLOYER' ? 'EMPLOYER' : 'STUDENT',
          emailVerified: role !== 'EMPLOYER',
          ...(role === 'EMPLOYER'
            ? {
                employerProfile: {
                  create: {
                    companyName: normalizedCompanyName,
                    country: 'South Africa',
                  },
                },
              }
            : {
                studentProfile: {
                  create: {
                    firstName: normalizedFirstName,
                    lastName: normalizedLastName,
                    university: normalizedUniversity,
                    country: 'South Africa',
                  },
                },
              }),
        },
        include: {
          studentProfile: true,
          employerProfile: true,
        },
      });

      if (rawVerificationToken) {
        await createEmailVerificationToken(
          transaction,
          createdUser.id,
          crypto.createHash('sha256').update(rawVerificationToken).digest('hex'),
          getEmailVerificationExpiry(),
        );
      }
      return createdUser;
    });

    if (rawVerificationToken) {
      try {
        await sendVerificationEmail(user.email, rawVerificationToken);
      } catch (error) {
        logEmailDeliveryFailure(error, 'Registration');
        await prisma.emailVerificationToken.updateMany({
          where: {
            userId: user.id,
            used: false,
          },
          data: { used: true },
        });
        res.status(503).json({
          success: false,
          code: 'EMAIL_DELIVERY_FAILED',
          message: 'Your account was created, but the verification email could not be delivered. Please try resending later.',
        });
        return;
      }
    } else {
      const token = signToken({ userId: user.id, email: user.email, role: user.role });
      setAuthCookie(res, token);
    }

    res.status(201).json({
      success: true,
      message: rawVerificationToken
        ? 'Account created. Verify your organisation email address before signing in.'
        : 'Account created successfully.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
          profile: user.studentProfile || user.employerProfile,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(createError('Email and password are required.', 400));
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { studentProfile: true, employerProfile: true },
    });

    if (!user) {
      return next(createError('Invalid email or password.', 401));
    }

    const isMatch = await verifyPassword(password, user.password);
    if (!isMatch) {
      return next(createError('Invalid email or password.', 401));
    }

    if (user.role === 'EMPLOYER' && !user.emailVerified) {
      res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your organisation email address before signing in.',
      });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    setAuthCookie(res, token);

    res.json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
          profile: user.studentProfile || user.employerProfile,
        },
      },
    });
  } catch (err) {
    const errorCode = getLoginDatabaseErrorCode(err);
    if (errorCode) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('[auth] Login database query failed.', { errorCode });
      }
      return next(createError('Login is temporarily unavailable. Please try again.', 503));
    }
    next(err);
  }
};

export const getMe = async (req: Request & { user?: { userId: string } }, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(createError('Unauthorized.', 401));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, employerProfile: true },
    });

    if (!user) return next(createError('User not found.', 404));

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        profile: user.studentProfile || user.employerProfile,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const logout = (_req: Request, res: Response): void => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out successfully.' });
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) return next(createError('Email is required.', 400));

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    const resetResponse = 'If an account with that email exists, the reset request has been accepted.';

    // Keep responses identical so callers cannot enumerate accounts.
    if (!user) {
      res.json({ success: true, message: resetResponse });
      return;
    }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    res.json({
      success: true,
      message: resetResponse,
    });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password } = req.body;
    if (!token || typeof password !== 'string') return next(createError('Token and new password are required.', 400));
    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      return next(createError(passwordError, 400));
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.used || record.expiresAt < new Date()) {
      return next(createError('Invalid or expired reset token. Please request a new one.', 400));
    }

    const hashedPassword = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { password: hashedPassword } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    ]);

    res.json({ success: true, message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    next(err);
  }
};

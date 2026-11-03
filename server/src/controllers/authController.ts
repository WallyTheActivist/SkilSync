import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { signToken } from '../utils/jwt';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie';
import { hashPassword, verifyPassword } from '../utils/password';
import { createError } from '../middleware/errorHandler';

const hasLetter = /\p{L}/u;
const meaningfulTextPattern = /^[\p{N}\p{P}\p{S}\p{Zs}\s]+$/u;

const validatePersonName = (value: unknown, label: string): string => {
  if (typeof value !== 'string') {
    throw createError(`${label} must be text.`, 400);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw createError(`${label} is required.`, 400);
  }
  if (trimmed.length > 80) {
    throw createError(`${label} must be between 1 and 80 characters.`, 400);
  }
  if (!hasLetter.test(trimmed) || meaningfulTextPattern.test(trimmed)) {
    throw createError(`${label} must include letters and may contain spaces, apostrophes, hyphens, or periods.`, 400);
  }

  return trimmed;
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

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, firstName, lastName, role = 'STUDENT', university, companyName } = req.body;

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedFirstName = validatePersonName(firstName, 'First name');
    const normalizedLastName = validatePersonName(lastName, 'Last name');
    const normalizedUniversity = role === 'EMPLOYER' ? '' : validateInstitutionName(university, 'University');
    const normalizedCompanyName = role === 'EMPLOYER' ? validateInstitutionName(companyName, 'Company name') : '';

    if (!normalizedEmail || !password) {
      return next(createError('Email and password are required.', 400));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return next(createError('Please provide a valid email address.', 400));
    }

    if (password.length < 12 || password.length > 72 || Buffer.byteLength(password, 'utf8') > 72) {
      return next(createError('Password must be 12-72 characters and no more than 72 UTF-8 bytes.', 400));
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return next(createError('An account with this email already exists.', 409));
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role: role === 'EMPLOYER' ? 'EMPLOYER' : 'STUDENT',
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

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
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
          profile: user.studentProfile || user.employerProfile,
        },
      },
    });
  } catch (err) {
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
    if (!token || !password) return next(createError('Token and new password are required.', 400));
    if (password.length < 12 || password.length > 72 || Buffer.byteLength(password, 'utf8') > 72) {
      return next(createError('Password must be 12-72 characters and no more than 72 UTF-8 bytes.', 400));
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

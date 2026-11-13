import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import prisma from '../config/database';
import { createError } from '../middleware/errorHandler';
import {
  EmailDeliveryConfigurationError,
  getEmailVerificationConfig,
  getEmailVerificationExpiry,
  sendVerificationEmail,
} from '../services/emailVerificationService';
import { normalizeRegistrationEmail } from '../utils/registrationValidation';

const genericResendResponse = {
  success: true,
  message: 'If an unverified employer account exists, the verification request has been accepted.',
};

const logEmailDeliveryFailure = (error: unknown): void => {
  const errorCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : 'unclassified';
  console.error('[email-verification] Resend delivery failed.', { errorCode });
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawToken: unknown = req.body.token;
    if (typeof rawToken !== 'string' || !/^[a-f\d]{64}$/i.test(rawToken)) {
      return next(createError('Invalid verification link.', 400));
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.emailVerificationToken.updateMany({
        where: { tokenHash, used: false, expiresAt: { gt: now } },
        data: { used: true },
      });
      if (consumed.count !== 1) {
        const record = await transaction.emailVerificationToken.findUnique({
          where: { tokenHash },
        });
        if (!record) {
          throw createError('Invalid verification link.', 400);
        }
        if (record.used) {
          throw createError('This verification link has already been used.', 400);
        }
        if (record.expiresAt <= now) {
          throw createError('This verification link has expired. Request a new verification email.', 400);
        }
        throw createError('This verification link is no longer valid. Request a new verification email.', 400);
      }

      const record = await transaction.emailVerificationToken.findUnique({
        where: { tokenHash },
      });
      if (!record) {
        throw createError('Invalid verification link.', 400);
      }

      const user = await transaction.user.findUnique({
        where: { id: record.userId },
        select: { id: true, role: true },
      });
      if (!user || user.role !== 'EMPLOYER') {
        throw createError('Invalid verification link.', 400);
      }

      await transaction.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    });

    res.json({
      success: true,
      message: 'Your organisation email has been verified. You can now sign in.',
    });
  } catch (error) {
    next(error);
  }
};

export const resendEmailVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
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

    const email = normalizeRegistrationEmail(req.body.email);
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, emailVerified: true },
    });

    if (!user || user.role !== 'EMPLOYER' || user.emailVerified) {
      res.status(202).json(genericResendResponse);
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const candidate = await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: getEmailVerificationExpiry(),
      },
    });

    try {
      await sendVerificationEmail(user.email, rawToken);
    } catch (error) {
      logEmailDeliveryFailure(error);
      await prisma.emailVerificationToken.updateMany({
        where: { id: candidate.id, used: false },
        data: { used: true },
      });
      res.status(202).json(genericResendResponse);
      return;
    }

    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, used: false, id: { not: candidate.id } },
      data: { used: true },
    });

    res.status(202).json(genericResendResponse);
  } catch (error) {
    next(error);
  }
};

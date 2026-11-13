import rateLimit, { Options, RateLimitRequestHandler } from 'express-rate-limit';

export const createEmailVerificationRateLimiter = (
  options: Pick<Options, 'max' | 'windowMs'> = { max: 5, windowMs: 15 * 60 * 1000 },
): RateLimitRequestHandler => rateLimit({
  ...options,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification requests. Please try again later.',
  },
});

import rateLimit from 'express-rate-limit';
import { RequestHandler } from 'express';

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX = 20;

export interface AuthRateLimitSettings {
  enabled: boolean;
  windowMs: number;
  max: number;
}

export const getAuthRateLimitSettings = (
  env: NodeJS.ProcessEnv = process.env
): AuthRateLimitSettings => {
  return {
    enabled: env.NODE_ENV !== 'development',
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    max: AUTH_RATE_LIMIT_MAX,
  };
};

export const createAuthRateLimiter = (
  settings: AuthRateLimitSettings = getAuthRateLimitSettings()
): RequestHandler => {
  if (!settings.enabled) {
    return (_req, _res, next) => next();
  }

  return rateLimit({
    windowMs: settings.windowMs,
    max: settings.max,
    message: { success: false, message: 'Too many login attempts. Please try again later.' },
  });
};

export const createApiRateLimiter = (
  authSettings: AuthRateLimitSettings = getAuthRateLimitSettings(),
  options: { windowMs?: number; max?: number } = {}
): RequestHandler => rateLimit({
  windowMs: options.windowMs ?? 15 * 60 * 1000,
  max: options.max ?? 200,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  skip: (req) =>
    !authSettings.enabled && (req.path === '/auth' || req.path.startsWith('/auth/')),
});

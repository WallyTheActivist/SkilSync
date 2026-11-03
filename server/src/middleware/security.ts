import { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_BODY_DEPTH = 8;
const MAX_BODY_KEYS = 200;
const MAX_STRING_LENGTH = 20_000;

const configuredOrigins = (): Set<string> => {
  const values = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(values.map((value) => new URL(value).origin));
};

export const verifyRequestOrigin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const authCookie = req.headers.cookie?.split(';').some((part) => part.trim().startsWith('ss_token='));
  const origin = req.get('origin');
  const referer = req.get('referer');
  let requestOrigin: string | undefined;

  try {
    requestOrigin = origin ? new URL(origin).origin : referer ? new URL(referer).origin : undefined;
  } catch {
    res.status(403).json({ success: false, message: 'Request origin is not allowed.' });
    return;
  }

  // Cookie-authenticated writes require a same-site browser origin; bearer clients may omit it.
  if ((authCookie && !requestOrigin) || (requestOrigin && !configuredOrigins().has(requestOrigin))) {
    res.status(403).json({ success: false, message: 'Request origin is not allowed.' });
    return;
  }

  next();
};

const inspectValue = (value: unknown, depth: number, keyCount: { value: number }): boolean => {
  if (depth > MAX_BODY_DEPTH) return false;
  if (typeof value === 'string') return value.length <= MAX_STRING_LENGTH;
  if (value === null || typeof value !== 'object') return true;

  if (Array.isArray(value)) {
    return value.length <= MAX_BODY_KEYS && value.every((item) => inspectValue(item, depth + 1, keyCount));
  }

  for (const [key, child] of Object.entries(value)) {
    keyCount.value += 1;
    if (keyCount.value > MAX_BODY_KEYS || BLOCKED_KEYS.has(key)) return false;
    if (!inspectValue(child, depth + 1, keyCount)) return false;
  }

  return true;
};

export const validateJsonBody = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body === undefined || req.body === null) {
    next();
    return;
  }

  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ success: false, message: 'Request body must be a JSON object.' });
    return;
  }

  if (!inspectValue(req.body, 0, { value: 0 })) {
    res.status(400).json({ success: false, message: 'Request body contains invalid or oversized data.' });
    return;
  }

  next();
};
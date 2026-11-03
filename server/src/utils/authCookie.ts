import { Response } from 'express';

const COOKIE_NAME = 'ss_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/api',
  });
};

export const clearAuthCookie = (res: Response): void => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
  });
};
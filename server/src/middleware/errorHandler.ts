import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.isOperational ? err.message : 'An unexpected error occurred. Please try again.';

  if (process.env.NODE_ENV !== 'test') {
    const errorCode = typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : 'unclassified';
    console.error('[ERROR]', { statusCode, errorCode });
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  });
};

export const createError = (message: string, statusCode: number): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

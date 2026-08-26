import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Centralized error handler. Never leaks stack traces to clients; always logs with requestId for tracing.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.requestId;

  if (err instanceof ZodError) {
    logger.warn({ requestId, issues: err.issues }, 'validation_error');
    return res.status(400).json({ error: 'Validation failed', details: err.issues, requestId });
  }

  if (err instanceof ApiError) {
    logger.warn({ requestId, status: err.status }, err.message);
    return res.status(err.status).json({ error: err.message, requestId });
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error({ requestId, err }, 'unhandled_error');
  return res.status(500).json({ error: 'Internal server error', message, requestId });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}

// Wraps async route handlers so rejected promises reach errorHandler instead of hanging.
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

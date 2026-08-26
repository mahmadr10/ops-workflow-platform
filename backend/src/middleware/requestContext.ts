import { NextFunction, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { logger } from '../lib/logger';

// Request tracing: every request gets a correlation id, echoed back and logged on completion.
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const requestId = typeof incoming === 'string' && incoming ? incoming : uuid();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();
  res.on('finish', () => {
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
        userId: req.user?.id,
      },
      'request_completed'
    );
  });
  next();
}

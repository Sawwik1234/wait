import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/** Attaches a per-request id used in logs and error envelopes. */
export function RequestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id');
  const requestId = typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
  (req as Request & { requestId?: string }).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

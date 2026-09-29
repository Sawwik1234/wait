import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL';
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        code = typeof b.code === 'string' ? b.code : defaultCode(status);
        message = typeof b.message === 'string' ? b.message : Array.isArray(b.message) ? (b.message as string[]).join('; ') : message;
      }
    } else if (exception instanceof Error) {
      // eslint-disable-next-line no-console
      console.error('[api] unhandled:', exception.message, exception.stack?.split('\n')[1]);
    }

    res.status(status).json({
      success: false,
      error: {
        code,
        message,
        requestId: (req as Request & { requestId?: string }).requestId ?? null,
      },
    });
  }
}

function defaultCode(status: number): string {
  if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHORIZED';
  if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
  if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
  if (status === HttpStatus.CONFLICT) return 'CONFLICT';
  if (status === HttpStatus.TOO_MANY_REQUESTS) return 'RATE_LIMITED';
  return 'ERROR';
}

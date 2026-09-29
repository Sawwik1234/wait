import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/** Wraps every controller response into the standard envelope { success, data, meta }. */
@Injectable()
export class WrapInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in (data as Record<string, unknown>)) {
          return data; // already enveloped
        }
        if (data && typeof data === 'object' && 'meta' in (data as Record<string, unknown>)) {
          const { meta, ...rest } = data as Record<string, unknown>;
          return { success: true, data: rest, meta };
        }
        return { success: true, data };
      }),
    );
  }
}

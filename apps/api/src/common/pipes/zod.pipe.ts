import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Validates request bodies/params against a Zod schema; returns parsed data. */
export class ZodPipe<T extends ZodType> implements PipeTransform<unknown, T['_output']> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): T['_output'] {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const first = result.error.issues[0];
      const where = first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'invalid payload';
      throw new BadRequestException({ code: 'VALIDATION', message: where });
    }
    return result.data;
  }
}

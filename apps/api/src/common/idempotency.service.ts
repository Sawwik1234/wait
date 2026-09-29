import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Idempotency: client sends `x-idempotency-key` (any stable string, ideally uuid)
 * on mutating requests. First execution stores the serialized response;
 * replays of the same (key, userId, endpoint) return the stored result
 * without re-executing the game logic — double-clicks and network retries
 * can never charge twice or duplicate rewards.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(userId: string, endpoint: string, key: string | undefined, fn: () => Promise<T>): Promise<T> {
    if (!key || key.length < 8 || key.length > 128) {
      // no/invalid key → execute directly (dedupe is opt-in per request)
      return fn();
    }

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key_userId_endpoint: { key, userId, endpoint } },
    });
    if (existing) {
      return JSON.parse(existing.responseJson) as T;
    }

    const result = await fn();

    await this.prisma.idempotencyKey
      .create({
        data: {
          key,
          userId,
          endpoint,
          responseJson: JSON.stringify(result),
        },
      })
      .catch(() => undefined); // racing create (unique) → result already stored by the winner

    return result;
  }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: ['error', 'warn'],
      // zero-config dev fallback: SQLite next to the schema when DATABASE_URL is unset
      ...(process.env.DATABASE_URL ? {} : { datasourceUrl: 'file:./dev.db' }),
    });

    // Enforce immutable ledger at the client level
    (this as any).ledger = this.wrapImmutableLedger((this as any).ledger);
  }

  private wrapImmutableLedger<T extends object>(targetLedger: T): T {
    if (!targetLedger) return targetLedger;
    return new Proxy(targetLedger, {
      get(target: any, prop: string | symbol) {
        if (
          typeof prop === 'string' &&
          ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(prop)
        ) {
          return () =>
            Promise.reject(
              new Error('LEDGER_IMMUTABLE: Ledger entries are append-only and cannot be modified or deleted'),
            );
        }
        return target[prop];
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

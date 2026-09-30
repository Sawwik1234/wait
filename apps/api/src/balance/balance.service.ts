import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app.exception';

type Tx = Prisma.TransactionClient | PrismaService;

export type LedgerType =
  | 'ISSUE'
  | 'REWARD'
  | 'RESERVE'
  | 'RELEASE'
  | 'ADJUSTMENT'
  | 'WELCOME_BONUS'
  | 'DAILY_REWARD'
  | 'CASE_OPEN'
  | 'UPGRADE_CONSUME'
  | 'UPGRADE_PAYOUT'
  | 'CONTRACT_CONSUME'
  | 'CONTRACT_PAYOUT'
  | 'SELL_ITEM'
  | 'MISSION_REWARD'
  | 'BATTLE_JOIN'
  | 'BATTLE_REFUND'
  | 'ADMIN_ADJUSTMENT';

export interface LedgerMeta {
  operationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * The ONLY way balance is mutated. Every change produces an immutable Ledger row.
 * Spending is race-safe: conditional decrement guarded by amount >= cost.
 */
@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Add points. `amount` must be > 0 and finite. */
  async grant(
    userId: string,
    amount: number,
    type: LedgerType,
    referenceId?: string,
    tx?: Prisma.TransactionClient,
    meta?: LedgerMeta,
  ): Promise<number> {
    if (amount <= 0 || !Number.isFinite(amount) || amount > 1_000_000_000) {
      throw new AppException('VALIDATION', 'Grant amount must be positive and finite', HttpStatus.BAD_REQUEST);
    }
    const db = (tx ?? this.prisma) as Tx;
    const current = await (db as PrismaClient).balance.findUnique({ where: { userId } });
    const balanceBefore = current?.amount ?? 0;

    const updated = await (db as PrismaClient).balance.update({
      where: { userId },
      data: { amount: { increment: amount } },
    });

    await (db as PrismaClient).ledger.create({
      data: {
        userId,
        amount,
        type,
        referenceId: referenceId ?? null,
        operationId: meta?.operationId ?? null,
        balanceBefore,
        balanceAfter: updated.amount,
        metadata: meta?.metadata ? JSON.stringify(meta.metadata) : null,
      },
    });

    return updated.amount;
  }

  /** Subtract points atomically; throws BALANCE_NOT_ENOUGH when funds are insufficient. */
  async spend(
    userId: string,
    amount: number,
    type: LedgerType,
    referenceId?: string,
    tx?: Prisma.TransactionClient,
    meta?: LedgerMeta,
  ): Promise<number> {
    if (amount <= 0 || !Number.isFinite(amount) || amount > 1_000_000_000) {
      throw new AppException('VALIDATION', 'Spend amount must be positive and finite', HttpStatus.BAD_REQUEST);
    }
    const db = (tx ?? this.prisma) as Tx;
    const current = await (db as PrismaClient).balance.findUnique({ where: { userId } });
    const balanceBefore = current?.amount ?? 0;

    const res = await (db as PrismaClient).balance.updateMany({
      where: { userId, amount: { gte: amount } },
      data: { amount: { decrement: amount } },
    });
    if (res.count === 0) {
      throw new AppException('BALANCE_NOT_ENOUGH', 'Not enough Arena Points', HttpStatus.PAYMENT_REQUIRED);
    }

    const updated = await (db as PrismaClient).balance.findUniqueOrThrow({ where: { userId } });

    await (db as PrismaClient).ledger.create({
      data: {
        userId,
        amount: -amount,
        type,
        referenceId: referenceId ?? null,
        operationId: meta?.operationId ?? null,
        balanceBefore,
        balanceAfter: updated.amount,
        metadata: meta?.metadata ? JSON.stringify(meta.metadata) : null,
      },
    });

    return updated.amount;
  }

  /** Grant XP (no ledger). */
  async grantXp(userId: string, xp: number, tx?: Prisma.TransactionClient): Promise<void> {
    const db = (tx ?? this.prisma) as Tx;
    await (db as PrismaClient).user.update({ where: { id: userId }, data: { xp: { increment: xp } } });
  }
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app.exception';
import { DailyEconomyStatsDto, EconomyAlertLevel } from './dto/daily-economy-stats.dto';

type Tx = Prisma.TransactionClient | PrismaService;

export const DEFAULT_DAILY_ISSUED_BASELINE = 100_000;
export const RESERVE_RATE = 0.05;
export const REWARD_BUDGET_RATE = 0.95;

function toDateKey(date?: Date | string): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class EconomyBudgetService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return or create the DailyEconomy record for the specified date.
   * If a new day row is created, it initializes with DEFAULT_DAILY_ISSUED_BASELINE.
   */
  async getOrCreateDaily(dateKey = toDateKey(), tx?: Prisma.TransactionClient) {
    const db = (tx ?? this.prisma) as Tx;
    const client = db as PrismaClient;

    const existing = await client.dailyEconomy.findUnique({
      where: { date: dateKey },
    });
    if (existing) return existing;

    try {
      return await client.dailyEconomy.create({
        data: {
          date: dateKey,
          issuedPoints: DEFAULT_DAILY_ISSUED_BASELINE,
          rewardedPoints: 0,
          reservedPoints: 0,
          version: 0,
        },
      });
    } catch {
      return await client.dailyEconomy.findUniqueOrThrow({
        where: { date: dateKey },
      });
    }
  }

  /** B_day: All virtual Arena Points issued for the day. */
  async getDailyIssued(date?: Date | string): Promise<number> {
    const daily = await this.getOrCreateDaily(toDateKey(date));
    return daily.issuedPoints;
  }

  /** W_day: All virtual Arena Points distributed as rewards for the day. */
  async getDailyRewards(date?: Date | string): Promise<number> {
    const daily = await this.getOrCreateDaily(toDateKey(date));
    return daily.rewardedPoints;
  }

  /**
   * Remaining budget:
   * remainingBudget = 0.95 * B_day - W_day - reservedPoints
   */
  async getRemainingBudget(date?: Date | string): Promise<number> {
    const daily = await this.getOrCreateDaily(toDateKey(date));
    const budget = Math.floor(daily.issuedPoints * REWARD_BUDGET_RATE);
    return Math.max(0, budget - daily.rewardedPoints - daily.reservedPoints);
  }

  /**
   * Can the system reward the requested amount right now without exceeding budget?
   */
  async canReward(amount: number, date?: Date | string): Promise<boolean> {
    if (amount <= 0 || !Number.isFinite(amount)) return false;
    const remaining = await this.getRemainingBudget(date);
    return remaining >= amount;
  }

  /**
   * Reserve an amount for an upcoming reward.
   * Can be called as reserveReward(amount) or reserveReward(amount, operationId, userId, ...).
   * Checks duplicate operationId and available budget with optimistic concurrency guard.
   */
  async reserveReward(
    amount: number,
    operationId?: string,
    userId?: string,
    metadata?: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
    date?: Date | string,
  ) {
    if (amount <= 0 || !Number.isFinite(amount) || amount > 100_000_000) {
      throw new AppException('VALIDATION', 'Reward amount must be a positive finite integer', HttpStatus.BAD_REQUEST);
    }
    const opId = operationId ?? `res_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const runner = async (dbClient: PrismaClient) => {
      // 1. Idempotency check: duplicate operationId
      const existingRes = await dbClient.economyReservation.findUnique({
        where: { operationId: opId },
      });
      if (existingRes) {
        throw new AppException('DUPLICATE_OPERATION', `Operation ${opId} already exists`, HttpStatus.CONFLICT);
      }
      const existingLedger = await dbClient.ledger.findFirst({
        where: { operationId: opId },
      });
      if (existingLedger) {
        throw new AppException('DUPLICATE_OPERATION', `Operation ${opId} already in ledger`, HttpStatus.CONFLICT);
      }

      // 2. Fetch and check budget
      const dateKey = toDateKey(date);
      const daily = await this.getOrCreateDaily(dateKey, dbClient as unknown as Prisma.TransactionClient);
      const budget = Math.floor(daily.issuedPoints * REWARD_BUDGET_RATE);
      const remaining = budget - daily.rewardedPoints - daily.reservedPoints;

      if (remaining <= 0 || amount > remaining) {
        throw new AppException(
          'BUDGET_EXCEEDED',
          `Daily reward budget exceeded: required ${amount} AP, remaining ${Math.max(0, remaining)} AP`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // 3. Atomically increment reservedPoints with version guard (OCC)
      const updateResult = await dbClient.dailyEconomy.updateMany({
        where: {
          id: daily.id,
          version: daily.version,
        },
        data: {
          reservedPoints: { increment: amount },
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        const fresh = await dbClient.dailyEconomy.findUniqueOrThrow({ where: { id: daily.id } });
        const freshBudget = Math.floor(fresh.issuedPoints * REWARD_BUDGET_RATE);
        const freshRemaining = freshBudget - fresh.rewardedPoints - fresh.reservedPoints;
        if (freshRemaining < amount) {
          throw new AppException(
            'BUDGET_EXCEEDED',
            `Daily reward budget exceeded on concurrent update: required ${amount} AP, remaining ${Math.max(0, freshRemaining)} AP`,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        throw new AppException(
          'CONCURRENCY_CONFLICT',
          'Concurrent reward reservation conflict, please retry',
          HttpStatus.CONFLICT,
        );
      }

      // 4. Create pending reservation record
      return await dbClient.economyReservation.create({
        data: {
          operationId: opId,
          date: dateKey,
          userId: userId ?? null,
          amount,
          status: 'PENDING',
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    };

    if (tx) {
      return runner(tx as unknown as PrismaClient);
    }
    return this.prisma.$transaction(async (trx: Prisma.TransactionClient) => runner(trx as unknown as PrismaClient));
  }

  /**
   * Commit a previously reserved reward (step 6 & 7):
   * transitions PENDING -> COMMITTED, shifts points from reserved to rewarded,
   * and creates an immutable Ledger row.
   */
  async commitReward(
    operationId: string,
    actualAmount?: number,
    tx?: Prisma.TransactionClient,
  ) {
    const runner = async (dbClient: PrismaClient) => {
      const reservation = await dbClient.economyReservation.findUnique({
        where: { operationId },
      });
      if (!reservation) {
        throw new AppException('NOT_FOUND', `Reservation ${operationId} not found`, HttpStatus.NOT_FOUND);
      }
      if (reservation.status !== 'PENDING') {
        throw new AppException('VALIDATION', `Reservation ${operationId} is already ${reservation.status}`, HttpStatus.BAD_REQUEST);
      }

      const rewardValue = actualAmount ?? reservation.amount;

      // Shift reserved -> rewarded
      await dbClient.dailyEconomy.update({
        where: { date: reservation.date },
        data: {
          reservedPoints: { decrement: reservation.amount },
          rewardedPoints: { increment: rewardValue },
        },
      });

      // Mark reservation committed
      await dbClient.economyReservation.update({
        where: { id: reservation.id },
        data: { status: 'COMMITTED' },
      });

      // Immutable Ledger record
      if (reservation.userId) {
        const userBalance = await dbClient.balance.findUnique({ where: { userId: reservation.userId } });
        const currentBal = userBalance?.amount ?? 0;
        await dbClient.ledger.create({
          data: {
            userId: reservation.userId,
            amount: 0, // item reward; value recorded in metadata
            type: 'REWARD',
            operationId,
            referenceId: reservation.id,
            balanceBefore: currentBal,
            balanceAfter: currentBal,
            metadata: JSON.stringify({
              rewardValue,
              status: 'COMMITTED',
              date: reservation.date,
              rawMeta: reservation.metadata ? JSON.parse(reservation.metadata) : null,
            }),
          },
        });
      }
    };

    if (tx) {
      return runner(tx as unknown as PrismaClient);
    }
    return this.prisma.$transaction(async (trx: Prisma.TransactionClient) => runner(trx as unknown as PrismaClient));
  }

  /**
   * Release an active reservation (by operationId or by raw amount).
   */
  async releaseReward(target: string | number, tx?: Prisma.TransactionClient, date?: Date | string) {
    const runner = async (dbClient: PrismaClient) => {
      if (typeof target === 'number') {
        const dateKey = toDateKey(date);
        await dbClient.dailyEconomy.update({
          where: { date: dateKey },
          data: {
            reservedPoints: { decrement: Math.max(0, target) },
          },
        });
        return;
      }

      const reservation = await dbClient.economyReservation.findUnique({
        where: { operationId: target },
      });
      if (!reservation || reservation.status !== 'PENDING') return;

      await dbClient.dailyEconomy.update({
        where: { date: reservation.date },
        data: {
          reservedPoints: { decrement: reservation.amount },
        },
      });

      await dbClient.economyReservation.update({
        where: { id: reservation.id },
        data: { status: 'RELEASED' },
      });

      if (reservation.userId) {
        const userBalance = await dbClient.balance.findUnique({ where: { userId: reservation.userId } });
        const currentBal = userBalance?.amount ?? 0;
        await dbClient.ledger.create({
          data: {
            userId: reservation.userId,
            amount: 0,
            type: 'RELEASE',
            operationId: target,
            referenceId: reservation.id,
            balanceBefore: currentBal,
            balanceAfter: currentBal,
            metadata: JSON.stringify({ releasedAmount: reservation.amount, reason: 'RESERVATION_RELEASED' }),
          },
        });
      }
    };

    if (tx) {
      return runner(tx as unknown as PrismaClient);
    }
    return this.prisma.$transaction(async (trx: Prisma.TransactionClient) => runner(trx as unknown as PrismaClient));
  }

  /**
   * Record virtual points issued into the economy (increases B_day, expanding reward budget).
   */
  async issueDailyPoints(
    amount: number,
    operationId?: string,
    userId?: string,
    metadata?: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
    date?: Date | string,
  ): Promise<number> {
    if (amount <= 0 || !Number.isFinite(amount)) {
      throw new AppException('VALIDATION', 'Issued points amount must be positive', HttpStatus.BAD_REQUEST);
    }

    const runner = async (dbClient: PrismaClient) => {
      const dateKey = toDateKey(date);
      const daily = await this.getOrCreateDaily(dateKey, dbClient as unknown as Prisma.TransactionClient);

      const updated = await dbClient.dailyEconomy.update({
        where: { id: daily.id },
        data: {
          issuedPoints: { increment: amount },
        },
      });

      if (userId) {
        const userBal = await dbClient.balance.findUnique({ where: { userId } });
        const curBal = userBal?.amount ?? 0;
        await dbClient.ledger.create({
          data: {
            userId,
            amount,
            type: 'ISSUE',
            operationId: operationId ?? null,
            balanceBefore: curBal,
            balanceAfter: curBal + amount,
            metadata: metadata ? JSON.stringify(metadata) : null,
          },
        });
      }

      return updated.issuedPoints;
    };

    if (tx) {
      return runner(tx as unknown as PrismaClient);
    }
    return this.prisma.$transaction(async (trx: Prisma.TransactionClient) => runner(trx as unknown as PrismaClient));
  }

  /**
   * Return comprehensive daily economy statistics:
   * date, issuedPoints, rewardedPoints, rewardBudget, remainingBudget, reservePoints, utilizationPercent, alertLevel
   */
  async getDailyStats(date?: Date | string): Promise<DailyEconomyStatsDto> {
    const dateKey = toDateKey(date);
    const daily = await this.getOrCreateDaily(dateKey);

    const issuedPoints = daily.issuedPoints;
    const rewardedPoints = daily.rewardedPoints;
    const reservedPoints = daily.reservedPoints;

    const rewardBudget = Math.floor(issuedPoints * REWARD_BUDGET_RATE);
    const reservePoints = Math.floor(issuedPoints * RESERVE_RATE);
    const remainingBudget = Math.max(0, rewardBudget - rewardedPoints - reservedPoints);

    const rawUtil = rewardBudget > 0 ? (rewardedPoints / rewardBudget) * 100 : 0;
    const utilizationPercent = Math.round(rawUtil * 100) / 100;

    let alertLevel: EconomyAlertLevel = 'NORMAL';
    if (remainingBudget <= 0) {
      alertLevel = 'BLOCK';
    } else if (utilizationPercent > 95) {
      alertLevel = 'CRITICAL';
    } else if (utilizationPercent > 85) {
      alertLevel = 'WARNING';
    }

    return {
      date: dateKey,
      issuedPoints,
      rewardedPoints,
      rewardBudget,
      remainingBudget,
      reservePoints,
      reservedPoints,
      utilizationPercent,
      alertLevel,
    };
  }

  /**
   * Return 30-day historical trend for the admin dashboard chart (Issued vs Rewards).
   */
  async getHistory(days = 30): Promise<DailyEconomyStatsDto[]> {
    const result: DailyEconomyStatsDto[] = [];
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000);
      const key = toDateKey(d);
      const row = await this.prisma.dailyEconomy.findUnique({ where: { date: key } });
      if (row) {
        const budget = Math.floor(row.issuedPoints * REWARD_BUDGET_RATE);
        const reserve = Math.floor(row.issuedPoints * RESERVE_RATE);
        const remaining = Math.max(0, budget - row.rewardedPoints - row.reservedPoints);
        const rawUtil = budget > 0 ? (row.rewardedPoints / budget) * 100 : 0;
        result.push({
          date: key,
          issuedPoints: row.issuedPoints,
          rewardedPoints: row.rewardedPoints,
          rewardBudget: budget,
          remainingBudget: remaining,
          reservePoints: reserve,
          reservedPoints: row.reservedPoints,
          utilizationPercent: Math.round(rawUtil * 100) / 100,
          alertLevel: remaining <= 0 ? 'BLOCK' : rawUtil > 95 ? 'CRITICAL' : rawUtil > 85 ? 'WARNING' : 'NORMAL',
        });
      } else {
        const budget = Math.floor(DEFAULT_DAILY_ISSUED_BASELINE * REWARD_BUDGET_RATE);
        const reserve = Math.floor(DEFAULT_DAILY_ISSUED_BASELINE * RESERVE_RATE);
        result.push({
          date: key,
          issuedPoints: DEFAULT_DAILY_ISSUED_BASELINE,
          rewardedPoints: 0,
          rewardBudget: budget,
          remainingBudget: budget,
          reservePoints: reserve,
          reservedPoints: 0,
          utilizationPercent: 0,
          alertLevel: 'NORMAL',
        });
      }
    }
    return result;
  }
}

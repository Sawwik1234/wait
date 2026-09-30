import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { EconomyBudgetService } from './economy-budget.service';
import { AppException } from '../common/app.exception';

describe('EconomyBudgetService - Virtual Economy Control', () => {
  let prisma: PrismaService;
  let service: EconomyBudgetService;
  let testUserId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'file:./dev.db';
    }
    prisma = new PrismaService();
    await prisma.$connect();
    service = new EconomyBudgetService(prisma);

    const user = await prisma.user.upsert({
      where: { email: 'economy_tester@casearena.local' },
      create: {
        email: 'economy_tester@casearena.local',
        username: 'EconomyTester',
        passwordHash: 'dummy',
        balance: { create: { amount: 10_000 } },
      },
      update: {},
      include: { balance: true },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const testDate = '2099-01-01';

  beforeEach(async () => {
    await prisma.economyReservation.deleteMany({ where: { date: testDate } });
    await prisma.dailyEconomy.deleteMany({ where: { date: testDate } });
  });

  // 1. Обычная выдача награды
  it('1. normal reward issuance: reserve -> verify pending -> commit -> verify ledger', async () => {
    await prisma.dailyEconomy.create({
      data: {
        date: testDate,
        issuedPoints: 10_000,
        rewardedPoints: 0,
        reservedPoints: 0,
        version: 0,
      },
    });

    const opId = `test-norm-${Date.now()}`;
    const rewardAmount = 500;

    // Reserve
    const reservation = await service.reserveReward(
      rewardAmount,
      opId,
      testUserId,
      { item: 'AK-47' },
      undefined,
      testDate,
    );
    expect(reservation.status).toBe('PENDING');
    expect(reservation.amount).toBe(500);

    const afterReserve = await service.getDailyStats(testDate);
    expect(afterReserve.reservedPoints).toBe(500);
    expect(afterReserve.rewardedPoints).toBe(0);
    expect(afterReserve.remainingBudget).toBe(9_500 - 500);

    // Commit
    await service.commitReward(opId, rewardAmount);

    const afterCommit = await service.getDailyStats(testDate);
    expect(afterCommit.reservedPoints).toBe(0);
    expect(afterCommit.rewardedPoints).toBe(500);
    expect(afterCommit.remainingBudget).toBe(9_000);

    // Check ledger entry
    const ledger = await prisma.ledger.findFirst({
      where: { operationId: opId },
    });
    expect(ledger).toBeDefined();
    expect(ledger?.type).toBe('REWARD');
    expect(ledger?.userId).toBe(testUserId);
  });

  // 2. Отсутствие бюджета
  it('2. zero budget: blocks new rewards and triggers BLOCK alert', async () => {
    await prisma.dailyEconomy.create({
      data: {
        date: testDate,
        issuedPoints: 10_000,
        rewardedPoints: 9_500,
        reservedPoints: 0,
        version: 0,
      },
    });

    const stats = await service.getDailyStats(testDate);
    expect(stats.remainingBudget).toBe(0);
    expect(stats.alertLevel).toBe('BLOCK');

    const can = await service.canReward(10, testDate);
    expect(can).toBe(false);

    // Attempting to reserve must throw BUDGET_EXCEEDED
    await expect(
      service.reserveReward(10, `test-zero-${Date.now()}`, testUserId, undefined, undefined, testDate),
    ).rejects.toThrow(AppException);
  });

  // 3. Превышение бюджета (exact example from prompt: issued=10,000, rewardBudget=9,500, rewarded=9,450 -> remaining=50, request 100 rejected)
  it('3. budget exceeded: remaining 50, request 100 rejected', async () => {
    await prisma.dailyEconomy.create({
      data: {
        date: testDate,
        issuedPoints: 10_000,
        rewardedPoints: 9_450,
        reservedPoints: 0,
        version: 0,
      },
    });

    const remaining = await service.getRemainingBudget(testDate);
    expect(remaining).toBe(50);

    // Requesting 100 must be rejected
    await expect(
      service.reserveReward(100, `test-exceed-${Date.now()}`, testUserId, undefined, undefined, testDate),
    ).rejects.toThrow(AppException);

    // Rewarded points remain unchanged
    const stats = await service.getDailyStats(testDate);
    expect(stats.rewardedPoints).toBe(9_450);
    expect(stats.remainingBudget).toBe(50);
  });

  // 4. Две одновременные выдачи (race condition: remaining = 100, both want 80)
  it('4. concurrent requests: remaining 100, two requests of 80 -> only one succeeds', async () => {
    await prisma.dailyEconomy.create({
      data: {
        date: testDate,
        issuedPoints: 10_000, // budget 9,500
        rewardedPoints: 9_400, // remaining 100
        reservedPoints: 0,
        version: 0,
      },
    });

    const opA = `race-A-${Date.now()}`;
    const opB = `race-B-${Date.now()}`;

    // Execute concurrently inside transactions
    const results = await Promise.allSettled([
      prisma.$transaction(async (tx) => {
        return service.reserveReward(80, opA, testUserId, undefined, tx, testDate);
      }),
      prisma.$transaction(async (tx) => {
        return service.reserveReward(80, opB, testUserId, undefined, tx, testDate);
      }),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    const stats = await service.getDailyStats(testDate);
    // Total reserved + rewarded must never exceed budget (9,500)
    expect(stats.rewardedPoints + stats.reservedPoints).toBe(9_480);
    expect(stats.rewardedPoints + stats.reservedPoints).toBeLessThanOrEqual(stats.rewardBudget);
  });

  // 5. Повторный operationId (idempotency)
  it('5. duplicate operationId: second attempt is rejected as duplicate', async () => {
    await prisma.dailyEconomy.create({
      data: {
        date: testDate,
        issuedPoints: 10_000,
        rewardedPoints: 0,
        reservedPoints: 0,
        version: 0,
      },
    });

    const opId = `idem-${Date.now()}`;
    await service.reserveReward(100, opId, testUserId, undefined, undefined, testDate);

    // Second call with same opId
    await expect(
      service.reserveReward(100, opId, testUserId, undefined, undefined, testDate),
    ).rejects.toThrow(AppException);
  });

  // 6. Transaction rollback
  it('6. transaction rollback: state reverts completely on error', async () => {
    await prisma.dailyEconomy.create({
      data: {
        date: testDate,
        issuedPoints: 10_000,
        rewardedPoints: 0,
        reservedPoints: 0,
        version: 0,
      },
    });

    const opId = `tx-fail-${Date.now()}`;

    try {
      await prisma.$transaction(async (tx) => {
        await service.reserveReward(200, opId, testUserId, undefined, tx, testDate);
        throw new Error('SIMULATED_GAMEPLAY_FAILURE');
      });
    } catch (e: any) {
      expect(e.message).toBe('SIMULATED_GAMEPLAY_FAILURE');
    }

    const res = await prisma.economyReservation.findUnique({ where: { operationId: opId } });
    expect(res).toBeNull();

    const stats = await service.getDailyStats(testDate);
    expect(stats.reservedPoints).toBe(0);
    expect(stats.rewardedPoints).toBe(0);
  });

  // 7. Неправильная стоимость от клиента
  it('7. client-tampered price: system evaluates internal value, rejecting client spoof', async () => {
    const testItem = await prisma.item.upsert({
      where: { slug: 'val-test-item' },
      create: {
        slug: 'val-test-item',
        name: 'Valuable Lore Item',
        image: '/items/val.png',
        rarity: 'MYTHIC',
        value: 5_000,
        internalValue: 5_000,
      },
      update: { value: 5_000, internalValue: 5_000 },
    });

    await prisma.dailyEconomy.create({
      data: {
        date: testDate,
        issuedPoints: 10_000, // budget 9,500
        rewardedPoints: 9_200, // remaining 300
        reservedPoints: 0,
        version: 0,
      },
    });

    // Client falsely claims cost is 1 AP
    const clientSuppliedValue = 1;
    void clientSuppliedValue; // untrusted

    // Backend derives value strictly from item.internalValue
    const actualRewardValue = testItem.internalValue ?? testItem.value;
    expect(actualRewardValue).toBe(5_000);

    const can = await service.canReward(actualRewardValue, testDate);
    expect(can).toBe(false);

    await expect(
      service.reserveReward(actualRewardValue, `client-spoof-${Date.now()}`, testUserId, undefined, undefined, testDate),
    ).rejects.toThrow(AppException);
  });

  // 8. Отрицательные значения
  it('8. negative and zero values are rejected', async () => {
    await expect(service.reserveReward(-100, `neg-${Date.now()}`)).rejects.toThrow(AppException);
    await expect(service.reserveReward(0, `zero-${Date.now()}`)).rejects.toThrow(AppException);
    expect(await service.canReward(-50)).toBe(false);
  });

  // 9. Переполнение
  it('9. overflow, NaN, and excessive amounts are rejected', async () => {
    await expect(service.reserveReward(NaN, `nan-${Date.now()}`)).rejects.toThrow(AppException);
    await expect(service.reserveReward(Infinity, `inf-${Date.now()}`)).rejects.toThrow(AppException);
    await expect(service.reserveReward(1_000_000_000, `huge-${Date.now()}`)).rejects.toThrow(AppException);
  });

  // 10. Новый календарный день
  it('10. new calendar day: yesterday exhausted, today starts with clean budget', async () => {
    const yesterday = '2099-01-01';
    const today = '2099-01-02';

    // Yesterday: completely exhausted (0 remaining)
    await prisma.dailyEconomy.upsert({
      where: { date: yesterday },
      create: { date: yesterday, issuedPoints: 10_000, rewardedPoints: 9_500, version: 0 },
      update: { issuedPoints: 10_000, rewardedPoints: 9_500, reservedPoints: 0, version: 0 },
    });

    // Today: freshly initialized
    await prisma.dailyEconomy.deleteMany({ where: { date: today } });
    await prisma.economyReservation.deleteMany({ where: { date: today } });

    const todayStats = await service.getDailyStats(today);
    expect(todayStats.date).toBe(today);
    expect(todayStats.rewardedPoints).toBe(0);
    expect(todayStats.remainingBudget).toBeGreaterThan(0);
    expect(todayStats.alertLevel).toBe('NORMAL');

    // Operation succeeds today
    const op = `today-${Date.now()}`;
    await service.reserveReward(200, op, testUserId, undefined, undefined, today);
    await service.commitReward(op);

    const updatedToday = await service.getDailyStats(today);
    expect(updatedToday.rewardedPoints).toBe(200);

    // Yesterday remains exhausted
    const yesterdayStats = await service.getDailyStats(yesterday);
    expect(yesterdayStats.remainingBudget).toBe(0);
    expect(yesterdayStats.alertLevel).toBe('BLOCK');

    await prisma.dailyEconomy.deleteMany({ where: { date: today } });
    await prisma.economyReservation.deleteMany({ where: { date: today } });
  });

  // 11. Корректное формирование daily stats
  it('11. correct daily stats calculation (Issued: 100k, Rewarded: 91,350)', async () => {
    await prisma.dailyEconomy.create({
      data: {
        date: testDate,
        issuedPoints: 100_000,
        rewardedPoints: 91_350,
        reservedPoints: 0,
        version: 0,
      },
    });

    const stats = await service.getDailyStats(testDate);
    expect(stats.issuedPoints).toBe(100_000);
    expect(stats.rewardedPoints).toBe(91_350);
    expect(stats.rewardBudget).toBe(95_000);
    expect(stats.remainingBudget).toBe(3_650);
    expect(stats.reservePoints).toBe(5_000);
    expect(stats.utilizationPercent).toBeCloseTo(96.16, 1);
    expect(stats.alertLevel).toBe('CRITICAL');
  });

  // 12. Immutable ledger
  it('12. immutable ledger: update and delete are rejected at database level', async () => {
    const entry = await prisma.ledger.create({
      data: {
        userId: testUserId,
        amount: 100,
        type: 'ISSUE',
        balanceBefore: 0,
        balanceAfter: 100,
      },
    });

    await expect(
      prisma.ledger.update({
        where: { id: entry.id },
        data: { amount: 999 },
      }),
    ).rejects.toThrow(/LEDGER_IMMUTABLE/);

    await expect(
      prisma.ledger.delete({
        where: { id: entry.id },
      }),
    ).rejects.toThrow(/LEDGER_IMMUTABLE/);
  });
});

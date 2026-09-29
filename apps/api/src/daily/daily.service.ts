import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RandomService } from '../common/random.service';
import { BalanceService } from '../balance/balance.service';
import { AppException } from '../common/app.exception';
import { ECONOMY } from '../common/economy';

export interface DailyRewardDay {
  day: number;
  type: 'POINTS' | 'ITEM';
  amount: number;
  rarityPool?: string;
}

/** 7-day cycle. Day 3 / 5 / 7 grant collectible items. */
export const DAILY_TABLE: DailyRewardDay[] = [
  { day: 1, type: 'POINTS', amount: 100 },
  { day: 2, type: 'POINTS', amount: 150 },
  { day: 3, type: 'ITEM', amount: 0, rarityPool: 'COMMON' },
  { day: 4, type: 'POINTS', amount: 200 },
  { day: 5, type: 'ITEM', amount: 0, rarityPool: 'RARE' },
  { day: 6, type: 'POINTS', amount: 250 },
  { day: 7, type: 'ITEM', amount: 0, rarityPool: 'SPECIAL' }, // rare 70 / epic 25 / mythic 5
];

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class DailyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly random: RandomService,
    private readonly balance: BalanceService,
  ) {}

  async status(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { lastDailyAt: true, streak: true },
    });

    const today = utcDayKey();
    const lastDay = user.lastDailyAt ? utcDayKey(user.lastDailyAt) : null;
    const yesterday = utcDayKey(new Date(Date.now() - 86_400_000));

    const canClaim = lastDay !== today;
    const continuing = lastDay === yesterday;
    const nextStreak = canClaim ? (continuing ? user.streak + 1 : 1) : user.streak;
    const cycleDay = ((nextStreak - 1) % 7) + 1;

    return {
      canClaim,
      streak: user.streak,
      nextCycleDay: cycleDay,
      nextReward: DAILY_TABLE[cycleDay - 1]!,
      table: DAILY_TABLE,
      serverDay: today,
    };
  }

  async claim(userId: string) {
    const status = await this.status(userId);
    if (!status.canClaim) {
      throw new AppException('ALREADY_CLAIMED', 'Daily reward already claimed today', HttpStatus.CONFLICT);
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { lastDailyAt: true, streak: true },
      });
      // re-check inside tx (race safety)
      const today = utcDayKey();
      if (user.lastDailyAt && utcDayKey(user.lastDailyAt) === today) {
        throw new AppException('ALREADY_CLAIMED', 'Daily reward already claimed today', HttpStatus.CONFLICT);
      }
      const yesterday = utcDayKey(new Date(Date.now() - 86_400_000));
      const continuing = user.lastDailyAt ? utcDayKey(user.lastDailyAt) === yesterday : false;
      const streak = continuing ? user.streak + 1 : 1;
      const cycleDay = ((streak - 1) % 7) + 1;
      const reward = DAILY_TABLE[cycleDay - 1]!;

      await tx.user.update({
        where: { id: userId },
        data: { streak, lastDailyAt: new Date() },
      });

      let itemId: string | null = null;
      let amount = 0;

      if (reward.type === 'POINTS') {
        amount = reward.amount;
        await this.balance.grant(userId, amount, 'DAILY_REWARD', `daily:${today}`, tx);
      } else {
        const picked = await this.pickRandomItem(reward.rarityPool!);
        itemId = picked.id;
        await tx.inventoryItem.create({
          data: { userId, itemId: picked.id, sourceType: 'DAILY_REWARD', sourceId: `daily:${today}` },
        });
        await tx.dailyClaim.create({
          data: { userId, day: cycleDay, rewardType: 'ITEM', itemId: picked.id, amount: 0 },
        });
      }

      if (reward.type === 'POINTS') {
        await tx.dailyClaim.create({
          data: { userId, day: cycleDay, rewardType: 'POINTS', amount },
        });
      }

      await this.balance.grantXp(userId, ECONOMY.XP.DAILY, tx);

      return { day: cycleDay, streak, reward, itemId, amount };
    });
  }

  private async pickRandomItem(pool: string) {
    let where;
    if (pool === 'COMMON') where = { rarity: 'COMMON' };
    else if (pool === 'RARE') where = { rarity: { in: ['UNCOMMON', 'RARE'] } };
    else {
      // SPECIAL: rare 70% / epic 25% / mythic 5%
      const roll = this.random.nextUint32() / 2 ** 32;
      const rarity = roll < 0.7 ? 'RARE' : roll < 0.95 ? 'EPIC' : 'MYTHIC';
      where = { rarity };
    }
    const candidates = await this.prisma.item.findMany({ where });
    if (candidates.length === 0) {
      const fallback = await this.prisma.item.findMany({ where: { rarity: 'COMMON' } });
      const idx = this.random.pickWeightedIndex(fallback.map(() => 1), this.random.nextUint32());
      return fallback[idx]!;
    }
    const weights = candidates.map(() => 1);
    const idx = this.random.pickWeightedIndex(weights, this.random.nextUint32());
    return candidates[idx]!;
  }
}

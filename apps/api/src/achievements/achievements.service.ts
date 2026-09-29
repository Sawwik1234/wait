import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceService } from '../balance/balance.service';

/**
 * Lazily-evaluated achievements: after each game action the relevant
 * evaluator recomputes the metric and unlocks any thresholds reached.
 */
@Injectable()
export class AchievementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
  ) {}

  /** Public catalog + the caller's unlocked subset. */
  async listFor(userId: string) {
    const all = await this.prisma.achievement.findMany({ orderBy: { sortOrder: 'asc' } });
    const mine = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, unlockedAt: true },
    });
    const unlocked = new Map(mine.map((m) => [m.achievementId, m.unlockedAt]));
    return {
      all: all.map((a) => ({
        code: a.code,
        title: a.title,
        description: a.description,
        icon: a.icon,
        xpReward: a.xpReward,
        threshold: a.threshold,
        unlocked: unlocked.has(a.id),
        unlockedAt: unlocked.get(a.id) ?? null,
      })),
      unlockedCount: unlocked.size,
    };
  }

  /** Compact public list for profiles. */
  async publicList(userId: string) {
    const rows = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: { select: { code: true, title: true, icon: true } } },
      orderBy: { unlockedAt: 'desc' },
    });
    return rows.map((r) => ({ code: r.achievement.code, title: r.achievement.title, icon: r.achievement.icon }));
  }

  /** Evaluate everything relevant after an action. Cheap enough at demo scale. */
  async evaluate(userId: string, context: 'OPEN' | 'UPGRADE' | 'CONTRACT' | 'DAILY'): Promise<void> {
    const defs = await this.prisma.achievement.findMany();
    const mine = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });
    const done = new Set(mine.map((m) => m.achievementId));

    for (const def of defs) {
      if (done.has(def.id)) continue;
      if (!this.relevant(def.conditionType, context)) continue;

      const value = await this.metric(userId, def.conditionType);
      if (value >= def.threshold) {
        const exists = await this.prisma.userAchievement.findUnique({
          where: { userId_achievementId: { userId, achievementId: def.id } },
        });
        if (exists) continue;
        await this.prisma.userAchievement.create({ data: { userId, achievementId: def.id } });
        await this.balance.grantXp(userId, def.xpReward);
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'REWARD',
            title: `${def.icon} Achievement: ${def.title}`,
            body: `${def.description} · +${def.xpReward} XP`,
          },
        });
      }
    }
  }

  private relevant(conditionType: string, ctx: string): boolean {
    switch (conditionType) {
      case 'OPEN_CASES':
      case 'RARITY_OWNED':
      case 'COLLECTION_COUNT':
        return ctx === 'OPEN';
      case 'WIN_UPGRADES':
        return ctx === 'UPGRADE';
      case 'CONTRACTS':
        return ctx === 'CONTRACT';
      case 'STREAK':
        return ctx === 'DAILY';
      default:
        return false;
    }
  }

  private async metric(userId: string, conditionType: string): Promise<number> {
    switch (conditionType) {
      case 'OPEN_CASES':
        return this.prisma.caseOpen.count({ where: { userId } });
      case 'WIN_UPGRADES':
        return this.prisma.upgrade.count({ where: { userId, success: true } });
      case 'CONTRACTS':
        return this.prisma.contract.count({ where: { userId } });
      case 'STREAK':
        return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { streak: true } }).then((u) => u.streak);
      case 'RARITY_OWNED':
        return this.prisma.inventoryItem.count({ where: { userId, status: 'OWNED', item: { rarity: 'MYTHIC' } } });
      case 'COLLECTION_COUNT':
        return this.prisma.inventoryItem.count({ where: { userId, status: 'OWNED' } });
      default:
        return 0;
    }
  }
}

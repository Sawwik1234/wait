import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { levelFromXp } from '../common/economy';

type Tab = 'xp' | 'collection' | 'opens' | 'profit';

@Injectable()
export class LeaderboardService {
  private cache = new Map<Tab, { at: number; rows: LeaderRow[] }>();
  private readonly ttlMs = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  async top(tab: Tab, limit = 50): Promise<LeaderRow[]> {
    const cached = this.cache.get(tab);
    if (cached && Date.now() - cached.at < this.ttlMs) return cached.rows;

    const rows = await this.compute(tab, limit);
    this.cache.set(tab, { at: Date.now(), rows });
    return rows;
  }

  private async compute(tab: Tab, limit: number): Promise<LeaderRow[]> {
    if (tab === 'xp') {
      const users = await this.prisma.user.findMany({
        orderBy: [{ xp: 'desc' }, { username: 'asc' }],
        take: limit,
        select: { username: true, xp: true, isBot: true },
      });
      return users.map((u, i) => ({
        rank: i + 1,
        username: u.username,
        score: u.xp,
        level: levelFromXp(u.xp).level,
        isBot: u.isBot,
      }));
    }

    if (tab === 'opens') {
      const grouped = await this.prisma.caseOpen.groupBy({
        by: ['userId'],
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: limit,
      });
      const users = await this.usersByIds(grouped.map((g) => g.userId));
      return grouped.map((g, i) => {
        const u = users.get(g.userId);
        return {
          rank: i + 1,
          username: u?.username ?? 'unknown',
          score: g._count._all,
          level: u ? levelFromXp(u.xp).level : 1,
          isBot: u?.isBot ?? false,
        };
      });
    }

    if (tab === 'collection') {
      const owned = await this.prisma.inventoryItem.findMany({
        where: { status: 'OWNED' },
        select: { userId: true, item: { select: { value: true } } },
      });
      const sums = new Map<string, number>();
      for (const row of owned) sums.set(row.userId, (sums.get(row.userId) ?? 0) + row.item.value);
      const top = [...sums.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
      const users = await this.usersByIds(top.map(([id]) => id));
      return top.map(([id, v], i) => {
        const u = users.get(id);
        return {
          rank: i + 1,
          username: u?.username ?? 'unknown',
          score: v,
          level: u ? levelFromXp(u.xp).level : 1,
          isBot: u?.isBot ?? false,
        };
      });
    }

    // 'profit': biggest single-case-open wins (by item value)
    const best = await this.prisma.caseOpen.findMany({
      orderBy: [{ item: { value: 'desc' } }, { createdAt: 'desc' }],
      take: limit,
      select: {
        userId: true,
        item: { select: { value: true, name: true, rarity: true } },
      },
    });
    const users = await this.usersByIds(best.map((b) => b.userId));
    return best.map((b, i) => {
      const u = users.get(b.userId);
      return {
        rank: i + 1,
        username: u?.username ?? 'unknown',
        score: b.item.value,
        level: u ? levelFromXp(u.xp).level : 1,
        isBot: u?.isBot ?? false,
        label: b.item.name,
      };
    });
  }

  private async usersByIds(ids: string[]) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true, xp: true, isBot: true },
    });
    return new Map(users.map((u) => [u.id, u]));
  }
}

export interface LeaderRow {
  rank: number;
  username: string;
  score: number;
  level: number;
  isBot: boolean;
  label?: string;
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RandomService } from '../common/random.service';
import { BalanceService } from '../balance/balance.service';
import { AppException } from '../common/app.exception';
import { ECONOMY, tableEv } from '../common/economy';
import { IdempotencyService } from '../common/idempotency.service';
import { MissionsService } from '../missions/missions.service';
import { AchievementsService } from '../achievements/achievements.service';

export interface OpenResult {
  inventoryItemId: string;
  item: {
    id: string;
    slug: string;
    name: string;
    image: string;
    rarity: string;
    value: number;
  };
  roll: number;
  seed: string;
}

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly random: RandomService,
    private readonly balance: BalanceService,
    private readonly idempotency: IdempotencyService,
    private readonly missions: MissionsService,
    private readonly achievements: AchievementsService,
  ) {}

  list(params: { q?: string; category?: string; sort?: string }) {
    const where: Prisma.CaseWhereInput = { isActive: true };
    if (params.category && params.category !== 'all') where.category = params.category;
    if (params.q) where.name = { contains: params.q };

    const orderBy: Prisma.CaseOrderByWithRelationInput[] =
      params.sort === 'price_asc'
        ? [{ price: 'asc' }]
        : params.sort === 'price_desc'
          ? [{ price: 'desc' }]
          : [{ displayOrder: 'asc' }, { price: 'asc' }];

    return this.prisma.case.findMany({
      where,
      orderBy,
      include: { items: { include: { item: true } } },
    });
  }

  async bySlug(slug: string) {
    const found = await this.prisma.case.findUnique({
      where: { slug },
      include: { items: { include: { item: true }, orderBy: { weight: 'desc' } } },
    });
    if (!found || (!found.isActive && !found.items.length)) {
      throw new AppException('CASE_NOT_FOUND', 'Case not found', HttpStatus.NOT_FOUND);
    }
    return found;
  }

  /** Public probabilities for the case page (percent chances shown to users are REAL). */
  static odds(caseWithItems: { price: number; rtp: number; items: { weight: number; item: { value: number } }[] }) {
    const total = caseWithItems.items.reduce((a, x) => a + x.weight, 0);
    const chances = caseWithItems.items.map((x) => (total > 0 ? (x.weight / total) * 100 : 0));
    const ev = tableEv(caseWithItems.items.map((x) => ({ value: x.item.value, weight: x.weight })));
    return {
      chances, // aligned with items order
      ev,
      rtp: caseWithItems.price > 0 ? ev / caseWithItems.price : 0,
    };
  }

  /**
   * Open a case `count` times. Server-authoritative:
   * balance check → atomic spend → per-open seeded RNG → inventory items.
   * Everything in ONE transaction; the client can never influence outcomes.
   */
  async open(userId: string, slug: string, count: number, idemKey?: string): Promise<{ results: OpenResult[]; balance: number; xp: number }> {
    return this.idempotency.run(userId, `cases.open:${slug}`, idemKey, () => this._open(userId, slug, count));
  }

  private async _open(userId: string, slug: string, count: number): Promise<{ results: OpenResult[]; balance: number; xp: number }> {
    const data = await this.prisma.case.findUnique({
      where: { slug },
      include: { items: { include: { item: true } } },
    });
    if (!data || !data.isActive) throw new AppException('CASE_NOT_FOUND', 'Case not found', HttpStatus.NOT_FOUND);
    if (data.items.length === 0) throw new AppException('CASE_EMPTY', 'Case has no items');

    const cost = data.price * count;
    if (cost > 100_000) throw new AppException('VALIDATION', 'Batch too large');

    return this.prisma.$transaction(async (tx) => {
      const balance = await this.balance.spend(userId, cost, 'CASE_OPEN', data.id, tx);

      const results: OpenResult[] = [];
      const weights = data.items.map((x) => x.weight);

      for (let i = 0; i < count; i++) {
        const seed = this.random.seedHex();
        const roll = this.random.nextUint32();
        const idx = this.random.pickWeightedIndex(weights, roll);
        const caseItem = data.items[idx]!;

        const inv = await tx.inventoryItem.create({
          data: {
            userId,
            itemId: caseItem.itemId,
            sourceType: 'CASE_OPEN',
            sourceId: data.id,
          },
        });

        const caseOpen = await tx.caseOpen.create({
          data: {
            userId,
            caseId: data.id,
            itemId: caseItem.itemId,
            cost: data.price,
            seed,
            roll: String(roll),
          },
        });

        await tx.caseItem.update({ where: { id: caseItem.id }, data: { rolls: { increment: 1 } } });

        results.push({
          inventoryItemId: inv.id,
          item: {
            id: caseItem.item.id,
            slug: caseItem.item.slug,
            name: caseItem.item.name,
            image: caseItem.item.image,
            rarity: caseItem.item.rarity,
            value: caseItem.item.value,
          },
          roll,
          seed,
        });
        void caseOpen;
      }

      const xp = ECONOMY.XP.CASE_OPEN * count;
      await this.balance.grantXp(userId, xp, tx);

      return { results, balance, xp };
    }).then(async (res) => {
      // post-tx hooks: missions + achievements (non-blocking on failure)
      try {
        await this.missions.track(userId, 'OPEN_CASES', count);
        for (const r of res.results) {
          await this.missions.track(userId, 'GET_RARITY', 1, r.item.rarity);
        }
        await this.achievements.evaluate(userId, 'OPEN');
      } catch {}
      return res;
    });
  }

  recentDrops(limit = 30) {
    return this.prisma.caseOpen.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 60),
      include: {
        item: true,
        user: { select: { username: true, isBot: true } },
        case: { select: { slug: true, name: true } },
      },
    });
  }
}

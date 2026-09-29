import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { AppException } from '../common/app.exception';
import { ECONOMY } from '../common/economy';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
  ) {}

  async list(
    userId: string,
    q: { rarity?: string; source?: string; search?: string; favorite?: boolean; sort?: string },
  ) {
    const where: Prisma.InventoryItemWhereInput = {
      userId,
      status: 'OWNED',
      isFavorite: q.favorite ? true : undefined,
      sourceType: q.source && q.source !== 'all' ? q.source : undefined,
      item: {
        rarity: q.rarity && q.rarity !== 'all' ? q.rarity : undefined,
        name: q.search ? { contains: q.search } : undefined,
      },
    };

    const orderBy: Prisma.InventoryItemOrderByWithRelationInput[] =
      q.sort === 'value_asc'
        ? [{ item: { value: 'asc' } }]
        : q.sort === 'new'
          ? [{ createdAt: 'desc' }]
          : [{ item: { value: 'desc' } }];

    const [items, agg] = await this.prisma.$transaction([
      this.prisma.inventoryItem.findMany({ where, orderBy, include: { item: true } }),
      this.prisma.inventoryItem.aggregate({
        where: { userId, status: 'OWNED' },
        _count: { _all: true },
      }),
    ]);

    const valueSum = items.reduce((a, x) => a + x.item.value, 0);
    const sellSum = items.reduce((a, x) => a + Math.floor(x.item.value * ECONOMY.SELL_RATE), 0);
    return { items, stats: { count: agg._count._all, shownValue: valueSum, sellSum } };
  }

  async setFavorite(userId: string, id: string, isFavorite: boolean) {
    const owned = await this.prisma.inventoryItem.findFirst({ where: { id, userId, status: 'OWNED' } });
    if (!owned) throw new AppException('ITEM_NOT_FOUND', 'Item not found', HttpStatus.NOT_FOUND);
    return this.prisma.inventoryItem.update({ where: { id }, data: { isFavorite } });
  }

  /**
   * Sell items back to the system for 30% of reference value each.
   * This is the main long-term AP sink on top of the case RTP.
   */
  async sell(userId: string, ids: string[]): Promise<{ soldCount: number; gained: number; balance: number }> {
    if (ids.length === 0 || ids.length > 100) throw new AppException('VALIDATION', 'Bad sell batch');

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.inventoryItem.findMany({
        where: { id: { in: ids }, userId, status: 'OWNED' },
        include: { item: true },
      });
      if (rows.length === 0) throw new AppException('ITEM_NOT_FOUND', 'Nothing to sell', HttpStatus.NOT_FOUND);

      const gained = rows.reduce((a, r) => a + Math.floor(r.item.value * ECONOMY.SELL_RATE), 0);

      await tx.inventoryItem.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { status: 'SOLD' },
      });

      const balance = await this.balance.grant(
        userId,
        gained,
        'SELL_ITEM',
        rows.map((r) => r.id).join(',').slice(0, 180),
        tx,
      );

      return { soldCount: rows.length, gained, balance };
    });
  }
}

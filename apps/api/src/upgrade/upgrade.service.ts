import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RandomService } from '../common/random.service';
import { BalanceService } from '../balance/balance.service';
import { AppException } from '../common/app.exception';
import { ECONOMY, upgradeChanceBp } from '../common/economy';

@Injectable()
export class UpgradeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly random: RandomService,
    private readonly balance: BalanceService,
  ) {}

  /** Targets available for a given input sum (value >= 1.2 × input). */
  async targets(inputCost: number) {
    const min = Math.ceil(inputCost * ECONOMY.UPGRADE_MIN_TARGET_FACTOR);
    const items = await this.prisma.item.findMany({
      where: { value: { gte: min, lte: Math.max(min, inputCost * 30) } },
      orderBy: { value: 'asc' },
      take: 80,
    });
    return {
      items: items.map((it) => ({
        id: it.id,
        slug: it.slug,
        name: it.name,
        image: it.image,
        rarity: it.rarity,
        value: it.value,
        chanceBp: upgradeChanceBp(inputCost, it.value),
      })),
    };
  }

  /**
   * Attempt an upgrade: consume 1–5 owned items (sum S), chase a target (value T).
   * Real chance = (S / T) × (1 − fee), clamped. EV for the player is −5% of S —
   * the honest house edge of the upgrade mode.
   */
  async run(userId: string, inventoryIds: string[], targetItemId: string) {
    if (inventoryIds.length < 1 || inventoryIds.length > 5) {
      throw new AppException('VALIDATION', 'Select 1–5 items');
    }

    return this.prisma.$transaction(async (tx) => {
      const inputs = await tx.inventoryItem.findMany({
        where: { id: { in: inventoryIds }, userId, status: 'OWNED' },
        include: { item: true },
      });
      if (inputs.length !== inventoryIds.length) {
        throw new AppException('ITEMS_NOT_OWNED', 'Some items are not available', HttpStatus.CONFLICT);
      }

      const inputCost = inputs.reduce((a, x) => a + x.item.value, 0);
      const target = await tx.item.findUnique({ where: { id: targetItemId } });
      if (!target) throw new AppException('TARGET_NOT_FOUND', 'Target item not found', HttpStatus.NOT_FOUND);

      const chanceBp = upgradeChanceBp(inputCost, target.value);
      if (chanceBp <= 0) {
        throw new AppException('TARGET_TOO_EXPENSIVE', 'Target must cost at least 1.2× the input');
      }

      const seed = this.random.seedHex();
      const roll = this.random.nextUint32();
      const success = roll / 2 ** 32 < chanceBp / 10_000;

      // consume inputs no matter what
      await tx.inventoryItem.updateMany({
        where: { id: { in: inputs.map((x) => x.id) } },
        data: { status: 'CONSUMED' },
      });

      let outputInventoryId: string | null = null;
      if (success) {
        const inv = await tx.inventoryItem.create({
          data: { userId, itemId: target.id, sourceType: 'UPGRADE', sourceId: seed },
        });
        outputInventoryId = inv.id;
        await tx.notification.create({
          data: {
            userId,
            type: 'REWARD',
            title: `Upgrade success: ${target.name}`,
            body: `You won ${target.name} (${target.value} AP) with a ${chanceBp / 100}% chance.`,
          },
        });
      }

      const record = await tx.upgrade.create({
        data: {
          userId,
          inputIds: JSON.stringify(inputs.map((x) => x.id)),
          inputCost,
          targetItemId,
          chanceBp,
          chanceShown: chanceBp / 100,
          roll: String(roll),
          success,
          seed,
        },
      });

      if (success && outputInventoryId) {
        await tx.inventoryItem.update({ where: { id: outputInventoryId }, data: { sourceId: record.id } });
      }

      await this.balance.grantXp(userId, ECONOMY.XP.UPGRADE, tx);

      return {
        success,
        chanceBp,
        chanceShown: chanceBp / 100,
        inputCost,
        target: {
          id: target.id,
          slug: target.slug,
          name: target.name,
          image: target.image,
          rarity: target.rarity,
          value: target.value,
        },
        outputInventoryId,
        roll,
        seed,
      };
    });
  }

  /** Recent upgrades for the live feed / profile. */
  recent(limit = 12) {
    return this.prisma.upgrade.findMany({
      where: { success: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 30),
      include: { targetItem: true, user: { select: { username: true, isBot: true } } },
    });
  }
}

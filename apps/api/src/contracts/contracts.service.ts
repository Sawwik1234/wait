import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RandomService } from '../common/random.service';
import { BalanceService } from '../balance/balance.service';
import { AppException } from '../common/app.exception';
import { ECONOMY, contractDistribution, contractPool } from '../common/economy';

interface PoolEntry {
  item: { id: string; slug: string; name: string; image: string; rarity: string; value: number };
  chance: number;
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly random: RandomService,
    private readonly balance: BalanceService,
  ) {}

  /** Compute the outcome pool + exact chances for a given input cost. */
  async preview(inputCost: number): Promise<{ pool: PoolEntry[]; targetEv: number }> {
    if (inputCost > ECONOMY.CONTRACT_MAX_INPUT_COST) {
      throw new AppException('VALIDATION', 'Contract input too large');
    }
    const catalogue = await this.prisma.item.findMany({ select: { id: true, value: true } });
    const idxs = contractPool(catalogue, inputCost);

    const values = idxs.map((i) => catalogue[i]!.value);
    const probs = contractDistribution(values, inputCost);

    const chosenIds = idxs.map((i) => catalogue[i]!.id);
    const items = await this.prisma.item.findMany({
      where: { id: { in: chosenIds } },
      select: { id: true, slug: true, name: true, image: true, rarity: true, value: true },
    });
    const byId = new Map<string, typeof items[number]>(items.map((it) => [it.id, it]));

    const pool = idxs
      .map((i, k) => ({
        item: byId.get(catalogue[i]!.id)!,
        chance: probs[k]!,
      }))
      .filter((x) => Boolean(x.item))
      .sort((a, b) => a.item.value - b.item.value);

    const ev = pool.reduce((a, x) => a + x.item.value * x.chance, 0);
    return { pool, targetEv: Math.round(ev) };
  }

  /**
   * Convert 3–5 owned items (sum S) into ONE random item from a pool whose
   * EV is 81% of S. Distribution is computed server-side and never shown
   * as "better" than it is.
   */
  async run(userId: string, inventoryIds: string[]) {
    if (inventoryIds.length < ECONOMY.CONTRACT_MIN_INPUTS || inventoryIds.length > ECONOMY.CONTRACT_MAX_INPUTS) {
      throw new AppException('VALIDATION', `Select ${ECONOMY.CONTRACT_MIN_INPUTS}–${ECONOMY.CONTRACT_MAX_INPUTS} items`);
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

      // Build pool + distribution inside the transaction (pure function).
      const catalogue = await tx.item.findMany({ select: { id: true, value: true } });
      const idxs = contractPool(catalogue, inputCost);
      const values = idxs.map((i) => catalogue[i]!.value);
      const probs = contractDistribution(values, inputCost);

      const seed = this.random.seedHex();
      const roll = this.random.nextUint32();

      // pick from the normalized distribution
      let u = roll / 2 ** 32;
      let chosen = idxs.length - 1;
      for (let k = 0; k < idxs.length; k++) {
        u -= probs[k]!;
        if (u < 0) {
          chosen = k;
          break;
        }
      }
      const outputItemId = catalogue[idxs[chosen]!]!.id;

      await tx.inventoryItem.updateMany({
        where: { id: { in: inputs.map((x) => x.id) } },
        data: { status: 'CONSUMED' },
      });

      const inv = await tx.inventoryItem.create({
        data: { userId, itemId: outputItemId, sourceType: 'CONTRACT', sourceId: seed },
      });

      const record = await tx.contract.create({
        data: {
          userId,
          inputIds: JSON.stringify(inputs.map((x) => x.id)),
          inputCost,
          outputItemId,
          seed,
          roll: String(roll),
        },
      });
      await tx.inventoryItem.update({ where: { id: inv.id }, data: { sourceId: record.id } });

      const output = await tx.item.findUniqueOrThrow({ where: { id: outputItemId } });

      if (output.rarity === 'EPIC' || output.rarity === 'MYTHIC') {
        await tx.notification.create({
          data: {
            userId,
            type: 'REWARD',
            title: `Contract: ${output.name}!`,
            body: `Your contract paid out ${output.name} (${output.value} AP).`,
          },
        });
      }

      await this.balance.grantXp(userId, ECONOMY.XP.CONTRACT, tx);

      return {
        inputCost,
        output: {
          id: output.id,
          slug: output.slug,
          name: output.name,
          image: output.image,
          rarity: output.rarity,
          value: output.value,
        },
        outputInventoryId: inv.id,
        roll,
        seed,
      };
    });
  }
}

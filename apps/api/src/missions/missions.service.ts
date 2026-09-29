import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { AppException } from '../common/app.exception';
import { RandomService } from '../common/random.service';

export type MissionEvent =
  | 'OPEN_CASES'
  | 'WIN_UPGRADES'
  | 'DO_CONTRACTS'
  | 'CLAIM_DAILY'
  | 'GET_RARITY';

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly random: RandomService,
  ) {}

  /** All active missions with the caller's progress. */
  async listFor(userId: string) {
    const missions = await this.prisma.mission.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    const mine = await this.prisma.userMission.findMany({ where: { userId } });
    const byId = new Map(mine.map((m) => [m.missionId, m]));

    return missions.map((m) => {
      const um = byId.get(m.id);
      const progress = um?.progress ?? 0;
      return {
        id: m.id,
        code: m.code,
        title: m.title,
        description: m.description,
        target: m.target,
        rewardAp: m.rewardAp,
        rewardItemRarity: m.rewardItemRarity,
        progress: Math.min(progress, m.target),
        completed: progress >= m.target,
        claimed: Boolean(um?.claimedAt),
      };
    });
  }

  /**
   * Increment progress of all active missions of the given type.
   * `rarity` is only used for GET_RARITY missions (Epic+/drops count).
   */
  async track(userId: string, event: MissionEvent, amount = 1, rarity?: string): Promise<void> {
    const missions = await this.prisma.mission.findMany({
      where: { isActive: true, type: event },
    });
    for (const m of missions) {
      if (event === 'GET_RARITY') {
        const pool = (m.rewardItemRarity ?? 'EPIC,MYTHIC').split(',');
        if (!rarity || !pool.includes(rarity)) continue;
      }
      await this.prisma.userMission.upsert({
        where: { userId_missionId: { userId, missionId: m.id } },
        create: { userId, missionId: m.id, progress: amount },
        update: { progress: { increment: amount } },
      });
      const um = await this.prisma.userMission.findUnique({
        where: { userId_missionId: { userId, missionId: m.id } },
      });
      if (um && um.progress >= m.target && !um.completedAt) {
        await this.prisma.userMission.update({
          where: { userId_missionId: { userId, missionId: m.id } },
          data: { completedAt: new Date() },
        });
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'SYSTEM',
            title: `Mission complete: ${m.title}`,
            body: `Claim your reward on the Missions page (+${m.rewardAp} AP).`,
          },
        });
      }
    }
  }

  /** Claim a completed mission's reward (once). */
  async claim(userId: string, missionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const m = await tx.mission.findUnique({ where: { id: missionId } });
      if (!m || !m.isActive) throw new AppException('NOT_FOUND', 'Mission not found', HttpStatus.NOT_FOUND);

      const um = await tx.userMission.findUnique({
        where: { userId_missionId: { userId, missionId } },
      });
      if (!um || um.progress < m.target) {
        throw new AppException('MISSION_NOT_COMPLETED', 'Mission is not completed yet');
      }
      if (um.claimedAt) {
        throw new AppException('ALREADY_CLAIMED', 'Reward already claimed', HttpStatus.CONFLICT);
      }

      await tx.userMission.update({
        where: { userId_missionId: { userId, missionId } },
        data: { claimedAt: new Date() },
      });

      let itemId: string | null = null;
      if (m.rewardAp > 0) {
        await this.balance.grant(userId, m.rewardAp, 'MISSION_REWARD' as never, m.id, tx);
      }
      if (m.rewardItemRarity) {
        const candidates = await tx.item.findMany({
          where: { rarity: { in: m.rewardItemRarity.split(',') } },
        });
        if (candidates.length > 0) {
          const idx = this.random.pickWeightedIndex(
            candidates.map(() => 1),
            this.random.nextUint32(),
          );
          const item = candidates[idx]!;
          itemId = item.id;
          await tx.inventoryItem.create({
            data: { userId, itemId: item.id, sourceType: 'MISSION' },
          });
        }
      }

      return { ok: true, rewardAp: m.rewardAp, itemId };
    });
  }
}

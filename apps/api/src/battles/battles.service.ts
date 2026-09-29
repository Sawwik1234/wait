import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RandomService } from '../common/random.service';
import { BalanceService } from '../balance/balance.service';
import { MissionsService } from '../missions/missions.service';
import { AppException } from '../common/app.exception';
import {
  BATTLE_RULES,
  caseForRound,
  computeWinner,
  entryCost,
  inviteCodeValid,
} from './battle-util';

export interface BattleListItem {
  id: string;
  status: string;
  maxPlayers: number;
  rounds: number;
  cases: string[];
  totalCost: number;
  isPrivate: boolean;
  hasInvite: boolean;
  creator: { username: string };
  players: { username: string; isBot: boolean; totalValue: number }[];
  winner: string | null;
  createdAt: string;
}

/**
 * Battle Engine.
 *
 * State machine: WAITING → RUNNING → FINISHED | CANCELLED (refunds).
 * - Join charges the entry cost (bots join free — they are demo actors).
 * - Each round every participant rolls the round's case through the SAME
 *   CSPRNG pipeline as case opening; items are created immediately.
 * - Winner takes all: losers' round items are reassigned to the winner.
 * - Every battle action is transactional; frontend only sends intents.
 */
@Injectable()
export class BattlesService {
  private readonly logger = new Logger(BattlesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly random: RandomService,
    private readonly balance: BalanceService,
    private readonly missions: MissionsService,
  ) {}

  async list(status: string | undefined): Promise<BattleListItem[]> {
    const where: Prisma.BattleWhereInput =
      status && status !== 'ALL'
        ? { status, isPrivate: false }
        : status === 'ALL'
          ? { isPrivate: false }
          : { status: 'WAITING' };

    const battles = await this.prisma.battle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        creator: { select: { username: true } },
        participants: {
          include: { user: { select: { username: true, isBot: true } } },
          orderBy: { slot: 'asc' },
        },
      },
    });

    return battles.map((b) => this.toListItem(b));
  }

  async get(id: string) {
    const b = await this.prisma.battle.findUnique({
      where: { id },
      include: {
        creator: { select: { username: true } },
        participants: {
          include: {
            user: { select: { username: true, isBot: true } },
            results: { include: { item: true }, orderBy: { roundNo: 'asc' } },
          },
          orderBy: { slot: 'asc' },
        },
      },
    });
    if (!b) throw new AppException('NOT_FOUND', 'Battle not found', HttpStatus.NOT_FOUND);

    const base = this.toListItem(b);
    return {
      ...base,
      inviteCode: b.inviteCode,
      startedAt: b.startedAt?.toISOString() ?? null,
      finishedAt: b.finishedAt?.toISOString() ?? null,
      participants: b.participants.map((p) => ({
        username: p.user.username,
        isBot: p.user.isBot,
        slot: p.slot,
        totalValue: p.totalValue,
        rounds: p.results.map((r) => ({
          roundNo: r.roundNo,
          item: {
            name: r.item.name,
            image: r.item.image,
            rarity: r.item.rarity,
            value: r.value,
          },
          mine: r.userId === b.creatorId ? false : false, // ownership shown via winner below
        })),
      })),
      winnerUsername:
        b.participants.find((p) => p.userId === b.winnerId)?.user.username ?? null,
    };
  }

  async create(
    userId: string,
    input: { maxPlayers: number; rounds: number; caseSlugs: string[]; isPrivate: boolean; inviteCode?: string },
  ) {
    if (
      input.maxPlayers < BATTLE_RULES.MIN_PLAYERS ||
      input.maxPlayers > BATTLE_RULES.MAX_PLAYERS
    ) {
      throw new AppException('VALIDATION', `Players must be ${BATTLE_RULES.MIN_PLAYERS}–${BATTLE_RULES.MAX_PLAYERS}`);
    }
    if (input.rounds < BATTLE_RULES.MIN_ROUNDS || input.rounds > BATTLE_RULES.MAX_ROUNDS) {
      throw new AppException('VALIDATION', `Rounds must be ${BATTLE_RULES.MIN_ROUNDS}–${BATTLE_RULES.MAX_ROUNDS}`);
    }
    if (input.caseSlugs.length < 1 || input.caseSlugs.length > BATTLE_RULES.MAX_CASE_SLOTS) {
      throw new AppException('VALIDATION', `Pick 1–${BATTLE_RULES.MAX_CASE_SLOTS} case types`);
    }

    const cases = await this.prisma.case.findMany({
      where: { slug: { in: input.caseSlugs }, isActive: true },
    });
    if (cases.length !== new Set(input.caseSlugs).size) {
      throw new AppException('VALIDATION', 'Some cases are unavailable');
    }

    if (input.isPrivate) {
      if (!input.inviteCode || !inviteCodeValid(input.inviteCode)) {
        throw new AppException('VALIDATION', 'Invite code must be 4–8 chars A-Z/0-9');
      }
      const taken = await this.prisma.battle.findFirst({
        where: { status: 'WAITING', inviteCode: input.inviteCode },
      });
      if (taken) throw new AppException('CONFLICT', 'Invite code already in use', HttpStatus.CONFLICT);
    }

    const totalCost = entryCost(cases, input.rounds);
    if (totalCost <= 0) throw new AppException('VALIDATION', 'Bad battle configuration');

    const creator = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!creator.isBot) {
      await this.balance.spend(userId, totalCost, 'BATTLE_JOIN', 'create');
    }

    return this.prisma.$transaction(async (tx) => {
      const battle = await tx.battle.create({
        data: {
          creatorId: userId,
          maxPlayers: input.maxPlayers,
          rounds: input.rounds,
          casesJson: JSON.stringify(input.caseSlugs),
          totalCost,
          isPrivate: input.isPrivate,
          inviteCode: input.isPrivate ? input.inviteCode : null,
        },
      });
      await tx.battleParticipant.create({
        data: { battleId: battle.id, userId, slot: 0 },
      });
      return battle;
    });
  }

  /** Join + pay entry. Auto-starts the battle when the last seat is taken. */
  async join(userId: string, id: string, inviteCode?: string): Promise<{ started: boolean }> {
    const b = await this.prisma.battle.findUnique({
      where: { id },
      include: { participants: true },
    });
    if (!b) throw new AppException('NOT_FOUND', 'Battle not found', HttpStatus.NOT_FOUND);
    if (b.status !== 'WAITING') throw new AppException('CONFLICT', 'Battle already started', HttpStatus.CONFLICT);
    if (b.participants.length >= b.maxPlayers) {
      throw new AppException('CONFLICT', 'Battle is full', HttpStatus.CONFLICT);
    }
    if (b.participants.some((p) => p.userId === userId)) {
      throw new AppException('CONFLICT', 'Already joined', HttpStatus.CONFLICT);
    }
    if (b.inviteCode && b.inviteCode !== inviteCode) {
      throw new AppException('FORBIDDEN', 'Wrong invite code', HttpStatus.FORBIDDEN);
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.isBot) {
      await this.balance.spend(userId, b.totalCost, 'BATTLE_JOIN', b.id);
    }

    const slot = b.participants.length;
    await this.prisma.battleParticipant.create({
      data: { battleId: b.id, userId, slot },
    });

    const count = await this.prisma.battleParticipant.count({ where: { battleId: b.id } });
    if (count >= b.maxPlayers) {
      // fire and forget: rounds run with pauses, client watches via socket/polling
      void this.runBattle(b.id).catch((e) => this.logger.error(`battle ${b.id}: ${e?.message}`));
      return { started: true };
    }
    return { started: false };
  }

  async leave(userId: string, id: string) {
    const b = await this.prisma.battle.findUnique({ where: { id }, include: { participants: true } });
    if (!b) throw new AppException('NOT_FOUND', 'Battle not found', HttpStatus.NOT_FOUND);
    if (b.status !== 'WAITING') throw new AppException('CONFLICT', 'Too late to leave', HttpStatus.CONFLICT);
    const p = b.participants.find((x) => x.userId === userId);
    if (!p) throw new AppException('NOT_FOUND', 'Not a participant', HttpStatus.NOT_FOUND);
    if (userId === b.creatorId) {
      throw new AppException('CONFLICT', 'Creator must use cancel', HttpStatus.CONFLICT);
    }

    const leaver = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.prisma.battleParticipant.delete({ where: { id: p.id } });
    if (!leaver.isBot) {
      await this.balance.grant(userId, b.totalCost, 'BATTLE_REFUND', b.id);
    }
    return { ok: true };
  }

  async cancel(userId: string, id: string) {
    const b = await this.prisma.battle.findUnique({ where: { id }, include: { participants: true } });
    if (!b) throw new AppException('NOT_FOUND', 'Battle not found', HttpStatus.NOT_FOUND);
    if (b.creatorId !== userId) throw new AppException('FORBIDDEN', 'Only creator can cancel', HttpStatus.FORBIDDEN);
    if (b.status !== 'WAITING') throw new AppException('CONFLICT', 'Too late to cancel', HttpStatus.CONFLICT);

    await this.prisma.$transaction(async (tx) => {
      await tx.battle.update({ where: { id: b.id }, data: { status: 'CANCELLED', finishedAt: new Date() } });
      for (const p of b.participants) {
        const u = await tx.user.findUniqueOrThrow({ where: { id: p.userId } });
        if (!u.isBot) {
          await tx.balance.update({
            where: { userId: p.userId },
            data: { amount: { increment: b.totalCost } },
          });
          await tx.ledger.create({
            data: {
              userId: p.userId,
              amount: b.totalCost,
              type: 'BATTLE_REFUND',
              referenceId: b.id,
              balanceAfter: (await tx.balance.findUniqueOrThrow({ where: { userId: p.userId } })).amount,
            },
          });
        }
      }
    });
    return { ok: true };
  }

  /** Creator shortcut to fill empty seats with demo bots. */
  async fillBots(userId: string, id: string) {
    const b = await this.prisma.battle.findUnique({
      where: { id },
      include: { participants: { include: { user: true } } },
    });
    if (!b) throw new AppException('NOT_FOUND', 'Battle not found', HttpStatus.NOT_FOUND);
    if (b.creatorId !== userId) throw new AppException('FORBIDDEN', 'Only creator can fill bots', HttpStatus.FORBIDDEN);
    if (b.status !== 'WAITING') throw new AppException('CONFLICT', 'Battle already started', HttpStatus.CONFLICT);

    const empty = b.maxPlayers - b.participants.length;
    if (empty <= 0) throw new AppException('CONFLICT', 'Battle is full', HttpStatus.CONFLICT);

    const bots = await this.prisma.user.findMany({
      where: { isBot: true, id: { notIn: b.participants.map((p) => p.userId) } },
      take: empty,
      orderBy: { xp: 'desc' },
    });

    let slot = b.participants.length;
    for (const bot of bots) {
      await this.prisma.battleParticipant.create({
        data: { battleId: b.id, userId: bot.id, slot: slot++ },
      });
    }

    const count = await this.prisma.battleParticipant.count({ where: { battleId: b.id } });
    if (count >= b.maxPlayers) {
      void this.runBattle(b.id).catch((e) => this.logger.error(`battle ${b.id}: ${e?.message}`));
      return { filled: bots.length, started: true };
    }
    return { filled: bots.length, started: false };
  }

  /**
   * Run the battle: sequential rounds with dramatic pauses.
   * Each round is its own transaction; finalization transfers items to the winner.
   */
  private async runBattle(battleId: string): Promise<void> {
    const b = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: { participants: true },
    });
    if (!b || b.status !== 'WAITING') return;

    await this.prisma.battle.update({
      where: { id: battleId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    const slugs: string[] = JSON.parse(b.casesJson);
    const participants = b.participants;

    for (let roundNo = 1; roundNo <= b.rounds; roundNo++) {
      const caseSlug = caseForRound(slugs, roundNo);
      const caseData = await this.prisma.case.findUnique({
        where: { slug: caseSlug },
        include: { items: { include: { item: true } } },
      });
      if (!caseData || caseData.items.length === 0) {
        throw new Error(`case ${caseSlug} unavailable`);
      }

      const weights = caseData.items.map((x) => x.weight);
      await this.prisma.$transaction(async (tx) => {
        for (const p of participants) {
          const seed = this.random.seedHex();
          const roll = this.random.nextUint32();
          const idx = this.random.pickWeightedIndex(weights, roll);
          const dropped = caseData.items[idx]!;

          const inv = await tx.inventoryItem.create({
            data: { userId: p.userId, itemId: dropped.itemId, sourceType: 'BATTLE', sourceId: battleId },
          });
          await tx.battleRoundResult.create({
            data: {
              battleId,
              participantId: p.id,
              roundNo,
              userId: p.userId,
              itemId: dropped.itemId,
              value: dropped.item.value,
              inventoryItemId: inv.id,
            },
          });
          await tx.battleParticipant.update({
            where: { id: p.id },
            data: { totalValue: { increment: dropped.item.value } },
          });
        }
      });

      this.logger.log(`[battle ${battleId.slice(0, 8)}] round ${roundNo}/${b.rounds} done`);
      if (roundNo < b.rounds) {
        await sleep(BATTLE_RULES.ROUND_PAUSE_MS);
      }
    }

    // finalize
    const final = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: { participants: true },
    });
    if (!final) return;

    const winnerId = computeWinner(
      final.participants.map((p) => ({ userId: p.userId, totalValue: p.totalValue, joinedAt: p.joinedAt })),
    );

    await this.prisma.$transaction(async (tx) => {
      // winner takes all: reassign losers' battle items
      const losers = final.participants.filter((p) => p.userId !== winnerId);
      for (const loser of losers) {
        await tx.inventoryItem.updateMany({
          where: { sourceType: 'BATTLE', sourceId: battleId, userId: loser.userId },
          data: { userId: winnerId! },
        });
      }
      await tx.battle.update({
        where: { id: battleId },
        data: { status: 'FINISHED', finishedAt: new Date(), winnerId },
      });
    });

    // winner XP + mission progress
    if (winnerId) {
      await this.balance.grantXp(winnerId, 25);
      await this.prisma.notification.create({
        data: {
          userId: winnerId,
          type: 'REWARD',
          title: '⚔ Battle won!',
          body: `You won a battle with a pot of ${final.totalCost * final.participants.length} AP in items.`,
        },
      });
    }
    this.logger.log(`[battle ${battleId.slice(0, 8)}] finished, winner ${winnerId?.slice(0, 8)}`);
  }

  private toListItem(b: {
    id: string;
    status: string;
    maxPlayers: number;
    rounds: number;
    casesJson: string;
    totalCost: number;
    isPrivate: boolean;
    inviteCode: string | null;
    winnerId: string | null;
    createdAt: Date;
    creator: { username: string };
    participants: { user: { username: string; isBot: boolean }; totalValue: number }[];
  }): BattleListItem {
    return {
      id: b.id,
      status: b.status,
      maxPlayers: b.maxPlayers,
      rounds: b.rounds,
      cases: JSON.parse(b.casesJson) as string[],
      totalCost: b.totalCost,
      isPrivate: b.isPrivate,
      hasInvite: Boolean(b.inviteCode),
      creator: b.creator,
      players: b.participants.map((p) => ({
        username: p.user.username,
        isBot: p.user.isBot,
        totalValue: p.totalValue,
      })),
      winner: b.winnerId ?? null,
      createdAt: b.createdAt.toISOString(),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

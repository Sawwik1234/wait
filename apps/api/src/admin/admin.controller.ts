import { Body, Controller, Get, Param, Patch, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { CasesService } from '../cases/cases.service';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/pipes/zod.pipe';

const UserPatchDto = z.object({
  role: z.enum(['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN']).optional(),
  isBot: z.boolean().optional(),
  adjust: z.number().int().min(-1_000_000).max(1_000_000).optional(),
});

const CasePatchDto = z.object({
  name: z.string().min(2).max(60).optional(),
  price: z.number().int().min(1).max(1_000_000).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(999).optional(),
});

const WeightsDto = z.object({
  weights: z.array(z.object({ caseItemId: z.string().uuid(), weight: z.number().int().min(1).max(1_000_000) })).min(1),
});

const TicketPatchDto = z.object({
  status: z.enum(['OPEN', 'ANSWERED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
});

@ApiTags('admin')
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly casesService: CasesService,
  ) {}

  private audit(actorId: string, action: string, entity?: string, entityId?: string, meta?: unknown) {
    return this.prisma.auditLog
      .create({
        data: {
          actorId,
          action,
          entity,
          entityId,
          meta: meta === undefined ? undefined : JSON.stringify(meta).slice(0, 2000),
        },
      })
      .catch(() => undefined);
  }

  // ---------- dashboard ----------

  @Get('stats')
  async stats() {
    const dayAgo = new Date(Date.now() - 86_400_000);
    const fourteenAgo = new Date(Date.now() - 14 * 86_400_000);

    const [users, bots, opensToday, spendRows, grantRows, ownedItems, upgrades, contracts] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isBot: true } }),
      this.prisma.caseOpen.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.ledger.findMany({ where: { type: 'CASE_OPEN', createdAt: { gte: fourteenAgo } }, select: { amount: true, createdAt: true } }),
      this.prisma.ledger.findMany({
        where: { type: { in: ['WELCOME_BONUS', 'DAILY_REWARD', 'SELL_ITEM', 'ADMIN_ADJUSTMENT'] }, createdAt: { gte: fourteenAgo } },
        select: { amount: true, createdAt: true },
      }),
      this.prisma.inventoryItem.count({ where: { status: 'OWNED' } }),
      this.prisma.upgrade.count(),
      this.prisma.contract.count(),
    ]);

    const byDay = new Map<string, { burned: number; granted: number }>();
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    for (let i = 13; i >= 0; i--) byDay.set(dayKey(new Date(Date.now() - i * 86_400_000)), { burned: 0, granted: 0 });
    for (const r of spendRows) {
      const k = dayKey(r.createdAt);
      const cur = byDay.get(k);
      if (cur) cur.burned += Math.abs(r.amount);
    }
    for (const r of grantRows) {
      const k = dayKey(r.createdAt);
      const cur = byDay.get(k);
      if (cur) cur.granted += Math.abs(r.amount);
    }

    const totals = await this.prisma.ledger.groupBy({
      by: ['type'],
      _sum: { amount: true },
    });

    return {
      users,
      bots,
      opensToday,
      ownedItems,
      upgrades,
      contracts,
      profitByDay: [...byDay.entries()].map(([date, v]) => ({ date, ...v, net: v.burned - v.granted })),
      totalsByType: totals.map((t) => ({ type: t.type, sum: t._sum.amount ?? 0 })),
    };
  }

  // ---------- users ----------

  @Get('users')
  async users(@Query('q') q?: string, @Query('page') page?: string) {
    const p = Math.max(1, Number(page) || 1);
    const where = q ? { OR: [{ username: { contains: q } }, { email: { contains: q } }] } : undefined;
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 25,
        skip: (p - 1) * 25,
        include: { balance: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      rows: rows.map(({ passwordHash: _ph, ...r }) => r),
      total,
      page: p,
      pages: Math.max(1, Math.ceil(total / 25)),
    };
  }

  @Patch('users/:id')
  async patchUser(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodPipe(UserPatchDto)) body: z.infer<typeof UserPatchDto>,
  ) {
    if (body.role || body.isBot !== undefined) {
      await this.prisma.user.update({
        where: { id },
        data: { ...(body.role ? { role: body.role } : {}), ...(body.isBot !== undefined ? { isBot: body.isBot } : {}) },
      });
    }
    let balance: number | undefined;
    if (body.adjust && body.adjust !== 0) {
      if (body.adjust > 0) balance = await this.balance.grant(id, body.adjust, 'ADMIN_ADJUSTMENT', `by:${actorId}`);
      else balance = await this.balance.spend(id, Math.abs(body.adjust), 'ADMIN_ADJUSTMENT', `by:${actorId}`);
    }
    await this.audit(actorId, 'USER_PATCH', 'User', id, body);
    const user = await this.prisma.user.findUnique({ where: { id }, include: { balance: true } });
    return { ok: true, balance: user?.balance?.amount ?? balance ?? null };
  }

  // ---------- cases ----------

  @Get('cases')
  async listCases() {
    const rows = await this.prisma.case.findMany({
      orderBy: { displayOrder: 'asc' },
      include: { items: { include: { item: true }, orderBy: { weight: 'desc' } } },
    });
    return rows.map((c) => {
      const odds = CasesService.odds(c);
      return { ...c, ev: odds.ev, actualRtp: odds.rtp, chances: odds.chances };
    });
  }

  @Patch('cases/:id')
  async patchCase(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodPipe(CasePatchDto)) body: z.infer<typeof CasePatchDto>,
  ) {
    const updated = await this.prisma.case.update({ where: { id }, data: body });
    await this.audit(actorId, 'CASE_PATCH', 'Case', id, body);
    return updated;
  }

  @Put('cases/:id/weights')
  async weights(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodPipe(WeightsDto)) body: z.infer<typeof WeightsDto>,
  ) {
    for (const w of body.weights) {
      await this.prisma.caseItem.updateMany({
        where: { id: w.caseItemId, caseId: id },
        data: { weight: w.weight },
      });
    }
    await this.audit(actorId, 'CASE_WEIGHTS', 'Case', id, body);
    const updated = await this.prisma.case.findUnique({
      where: { id },
      include: { items: { include: { item: true } } },
    });
    return updated ? { ...updated, odds: CasesService.odds(updated) } : null;
  }

  @Get('items')
  items() {
    return this.prisma.item.findMany({ orderBy: [{ value: 'desc' }], take: 200 });
  }

  // ---------- audit & tickets ----------

  @Get('audit')
  auditLog(@Query('limit') limit?: string) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 100, 300),
    });
  }

  @Get('tickets')
  tickets(@Query('status') status?: string) {
    return this.prisma.ticket.findMany({
      where: status && status !== 'ALL' ? { status } : undefined,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        user: { select: { username: true, email: true } },
      },
    });
  }

  @Patch('tickets/:id')
  async patchTicket(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodPipe(TicketPatchDto)) body: z.infer<typeof TicketPatchDto>,
  ) {
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.priority ? { priority: body.priority } : {}),
        updatedAt: new Date(),
      },
    });
    await this.audit(actorId, 'TICKET_PATCH', 'Ticket', id, body);
    return updated;
  }
}

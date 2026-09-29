import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CasesService } from '../cases/cases.service';

/**
 * Live feed: bot players open cases through the SAME authoritative pipeline
 * (CasesService.open). This keeps the "recent drops" feed alive and doubles
 * as a permanent integrity self-test: every bot roll is a real, audited roll.
 */
@Injectable()
export class LiveFeedService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cases: CasesService,
  ) {}

  onModuleInit() {
    if (process.env.LIVEFEED_ENABLED === '0') return;
    this.schedule(4000);
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(delayMs: number) {
    this.timer = setTimeout(() => void this.tick(), delayMs);
    this.timer.unref?.();
  }

  private async tick() {
    if (this.running) return this.schedule(5000);
    this.running = true;
    const base = Number(process.env.LIVEFEED_INTERVAL_MS ?? '9000') || 9000;
    try {
      const [bots, cases] = await Promise.all([
        this.prisma.user.findMany({ where: { isBot: true }, select: { id: true } }),
        this.prisma.case.findMany({ where: { isActive: true }, select: { slug: true, price: true } }),
      ]);
      // Weight cheaper cases higher for a natural-looking feed.
      if (bots.length && cases.length) {
        const bot = bots[Math.floor(Math.random() * bots.length)]!;
        const weighted = cases.flatMap((c) => (c.price <= 400 ? [c, c, c] : c.price <= 1500 ? [c] : []));
        const pool = weighted.length ? weighted : cases;
        const cs = pool[Math.floor(Math.random() * pool.length)]!;
        await this.cases.open(bot.id, cs.slug, 1);
      }
    } catch {
      // feed failures must never crash the API
    } finally {
      this.running = false;
      this.schedule(base + Math.floor(Math.random() * base));
    }
  }
}

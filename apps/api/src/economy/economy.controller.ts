import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EconomyBudgetService } from './economy-budget.service';
import { CurrentUser, Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('economy')
@Controller('economy')
export class EconomyController {
  constructor(
    private readonly budgetService: EconomyBudgetService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/economy/daily
   * Safe summary for regular users / public; full audit + 30-day trend for admins.
   */
  @Public()
  @Get('daily')
  async getDaily(
    @CurrentUser('role') role?: string,
    @Query('date') date?: string,
  ) {
    const stats = await this.budgetService.getDailyStats(date);

    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (!isAdmin) {
      return {
        date: stats.date,
        remainingBudget: stats.remainingBudget,
        dailyProgress: stats.utilizationPercent,
        utilizationPercent: stats.utilizationPercent,
        alertLevel: stats.alertLevel,
      };
    }

    // Full admin stats: include operations and 30-day history
    const [operations, history30Days] = await Promise.all([
      this.prisma.economyReservation.findMany({
        where: { date: stats.date },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.budgetService.getHistory(30),
    ]);

    return {
      ...stats,
      operations,
      history30Days,
    };
  }
}

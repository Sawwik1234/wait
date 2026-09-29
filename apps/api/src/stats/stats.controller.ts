import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('overview')
  async overview() {
    const [users, opens, drops, burned, granted] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.caseOpen.count(),
      this.prisma.inventoryItem.count(),
      this.prisma.ledger.aggregate({ where: { type: 'CASE_OPEN' }, _sum: { amount: true } }),
      this.prisma.ledger.aggregate({
        where: { type: { in: ['WELCOME_BONUS', 'DAILY_REWARD', 'SELL_ITEM', 'ADMIN_ADJUSTMENT', 'UPGRADE_PAYOUT', 'CONTRACT_PAYOUT'] } },
        _sum: { amount: true },
      }),
    ]);
    const burnedAbs = Math.abs(burned._sum.amount ?? 0);
    const grantedAbs = Math.abs(granted._sum.amount ?? 0);
    return {
      users,
      opens,
      drops,
      apBurned: burnedAbs,
      apGranted: grantedAbs,
      houseNet: burnedAbs - grantedAbs,
    };
  }
}

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BalanceModule } from './balance/balance.module';
import { CasesModule } from './cases/cases.module';
import { InventoryModule } from './inventory/inventory.module';
import { UpgradeModule } from './upgrade/upgrade.module';
import { ContractsModule } from './contracts/contracts.module';
import { DailyModule } from './daily/daily.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { StatsModule } from './stats/stats.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SupportModule } from './support/support.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BalanceModule,
    CasesModule,
    InventoryModule,
    UpgradeModule,
    ContractsModule,
    DailyModule,
    LeaderboardModule,
    StatsModule,
    NotificationsModule,
    SupportModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    // Global guards: order matters — auth first, then roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // (request-id middleware applied globally in main.ts as plain express middleware)
  }
}

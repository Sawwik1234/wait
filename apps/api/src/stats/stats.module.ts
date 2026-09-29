import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module';
import { StatsController } from './stats.controller';
import { LiveFeedService } from './livefeed.service';

@Module({
  imports: [CasesModule],
  providers: [LiveFeedService],
  controllers: [StatsController],
})
export class StatsModule {}

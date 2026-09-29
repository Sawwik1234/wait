import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { Public } from '../common/decorators';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Public()
  @Get()
  top(@Query('tab') tab?: string) {
    const t = (['xp', 'collection', 'opens', 'profit'] as const).find((x) => x === tab) ?? 'xp';
    return this.leaderboard.top(t);
  }
}

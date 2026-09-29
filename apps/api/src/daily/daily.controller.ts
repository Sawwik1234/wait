import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DailyService } from './daily.service';
import { CurrentUser } from '../common/decorators';

@ApiTags('daily')
@Controller('daily')
export class DailyController {
  constructor(private readonly daily: DailyService) {}

  @Get()
  status(@CurrentUser('id') userId: string) {
    return this.daily.status(userId);
  }

  @Post('claim')
  claim(@CurrentUser('id') userId: string) {
    return this.daily.claim(userId);
  }
}

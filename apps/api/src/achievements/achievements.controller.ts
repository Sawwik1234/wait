import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AchievementsService } from './achievements.service';
import { CurrentUser } from '../common/decorators';

@ApiTags('achievements')
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  mine(@CurrentUser('id') userId: string) {
    return this.achievements.listFor(userId);
  }
}

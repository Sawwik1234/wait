import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { UpgradeService } from './upgrade.service';
import { CurrentUser, Public } from '../common/decorators';
import { ZodPipe } from '../common/pipes/zod.pipe';

const RunDto = z.object({
  inventoryIds: z.array(z.string().uuid()).min(1).max(5),
  targetItemId: z.string().uuid(),
});

@ApiTags('upgrade')
@Controller('upgrade')
export class UpgradeController {
  constructor(private readonly upgrades: UpgradeService) {}

  @Get('targets')
  targets(@CurrentUser('id') _userId: string, @Query('sum') sum?: string) {
    return this.upgrades.targets(Math.max(1, Number(sum) || 1));
  }

  @Post('run')
  run(
    @CurrentUser('id') userId: string,
    @Body(new ZodPipe(RunDto)) body: z.infer<typeof RunDto>,
    @Headers('x-idempotency-key') idemKey?: string,
  ) {
    return this.upgrades.run(userId, body.inventoryIds, body.targetItemId, idemKey);
  }

  @Public()
  @Get('recent')
  recent() {
    return this.upgrades.recent();
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { MissionsService } from './missions.service';
import { CurrentUser } from '../common/decorators';
import { ZodPipe } from '../common/pipes/zod.pipe';

const ClaimDto = z.object({});

@ApiTags('missions')
@Controller('missions')
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.missions.listFor(userId);
  }

  @Post(':id/claim')
  claim(@CurrentUser('id') userId: string, @Param('id') id: string, @Body(new ZodPipe(ClaimDto)) _body: unknown) {
    return this.missions.claim(userId, id);
  }
}

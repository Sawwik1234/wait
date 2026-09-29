import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { BattlesService } from './battles.service';
import { BattlesGateway } from './battles.gateway';
import { CurrentUser, Public } from '../common/decorators';
import { ZodPipe } from '../common/pipes/zod.pipe';

const CreateDto = z.object({
  maxPlayers: z.number().int().min(2).max(4),
  rounds: z.number().int().min(1).max(10),
  caseSlugs: z.array(z.string().min(1).max(80)).min(1).max(5),
  isPrivate: z.boolean().default(false),
  inviteCode: z.string().regex(/^[A-Z0-9]{4,8}$/).optional(),
});

const JoinDto = z.object({ inviteCode: z.string().max(8).optional() });

@ApiTags('battles')
@Controller('battles')
export class BattlesController {
  constructor(
    private readonly battles: BattlesService,
    private readonly gateway: BattlesGateway,
  ) {}

  @Public()
  @Get()
  list(@Query('status') status?: string) {
    return this.battles.list(status);
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.battles.get(id);
  }

  @Post()
  async create(@CurrentUser('id') userId: string, @Body(new ZodPipe(CreateDto)) body: z.infer<typeof CreateDto>) {
    const created = await this.battles.create(userId, body);
    return { id: created.id };
  }

  @Post(':id/join')
  async join(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body(new ZodPipe(JoinDto)) body: z.infer<typeof JoinDto>,
  ) {
    const res = await this.battles.join(userId, id, body.inviteCode);
    this.gateway.emitBattle(id, 'battle:joined', { by: userId, started: res.started });
    if (res.started) this.gateway.emitBattle(id, 'battle:starting', { battleId: id });
    return res;
  }

  @Post(':id/leave')
  async leave(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const res = await this.battles.leave(userId, id);
    this.gateway.emitBattle(id, 'battle:cancelled', { by: userId, kind: 'leave' });
    return res;
  }

  @Post(':id/cancel')
  async cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const res = await this.battles.cancel(userId, id);
    this.gateway.emitBattle(id, 'battle:cancelled', { by: userId, kind: 'cancel' });
    return res;
  }

  @Post(':id/fill-bots')
  async fillBots(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const res = await this.battles.fillBots(userId, id);
    this.gateway.emitBattle(id, 'battle:joined', { by: 'bots', started: res.started });
    if (res.started) this.gateway.emitBattle(id, 'battle:starting', { battleId: id });
    return res;
  }
}

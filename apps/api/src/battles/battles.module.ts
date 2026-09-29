import { Module } from '@nestjs/common';
import { BattlesService } from './battles.service';
import { BattlesController } from './battles.controller';
import { BattlesGateway } from './battles.gateway';

@Module({
  providers: [BattlesService, BattlesGateway],
  controllers: [BattlesController],
  exports: [BattlesGateway],
})
export class BattlesModule {}

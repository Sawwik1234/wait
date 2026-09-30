import { Global, Module } from '@nestjs/common';
import { EconomyBudgetService } from './economy-budget.service';
import { EconomyController } from './economy.controller';

@Global()
@Module({
  controllers: [EconomyController],
  providers: [EconomyBudgetService],
  exports: [EconomyBudgetService],
})
export class EconomyModule {}

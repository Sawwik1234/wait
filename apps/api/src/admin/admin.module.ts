import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [CasesModule],
  controllers: [AdminController],
})
export class AdminModule {}

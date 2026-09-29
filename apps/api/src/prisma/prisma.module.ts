import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RandomService } from '../common/random.service';
import { IdempotencyService } from '../common/idempotency.service';

@Global()
@Module({
  providers: [PrismaService, RandomService, IdempotencyService],
  exports: [PrismaService, RandomService, IdempotencyService],
})
export class PrismaModule {}

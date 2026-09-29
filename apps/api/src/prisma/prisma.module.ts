import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RandomService } from '../common/random.service';

@Global()
@Module({
  providers: [PrismaService, RandomService],
  exports: [PrismaService, RandomService],
})
export class PrismaModule {}

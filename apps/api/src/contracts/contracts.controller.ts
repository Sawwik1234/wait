import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ContractsService } from './contracts.service';
import { CurrentUser } from '../common/decorators';
import { ZodPipe } from '../common/pipes/zod.pipe';

const PreviewDto = z.object({ inputCost: z.number().int().min(1).max(20000) });
const RunDto = z.object({
  inventoryIds: z.array(z.string().uuid()).min(3).max(5),
});

@ApiTags('contracts')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Post('preview')
  preview(@CurrentUser('id') _userId: string, @Body(new ZodPipe(PreviewDto)) body: z.infer<typeof PreviewDto>) {
    return this.contracts.preview(body.inputCost);
  }

  @Post('run')
  run(@CurrentUser('id') userId: string, @Body(new ZodPipe(RunDto)) body: z.infer<typeof RunDto>) {
    return this.contracts.run(userId, body.inventoryIds);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SupportService } from './support.service';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/pipes/zod.pipe';

const Category = z.enum(['ACCOUNT', 'COLLECTION', 'CASES', 'TECHNICAL', 'MODERATION', 'BUG', 'IDEA', 'OTHER']);

const CreateDto = z.object({
  subject: z.string().min(4).max(120),
  category: Category,
  text: z.string().min(5).max(4000),
});
const MessageDto = z.object({ text: z.string().min(1).max(4000) });
const AdminPatchDto = z.object({
  status: z.enum(['OPEN', 'ANSWERED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
});

@ApiTags('support')
@Controller()
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('support/tickets')
  create(@CurrentUser('id') userId: string, @Body(new ZodPipe(CreateDto)) body: z.infer<typeof CreateDto>) {
    return this.support.create(userId, body);
  }

  @Get('support/tickets')
  listMine(@CurrentUser('id') userId: string) {
    return this.support.listMine(userId);
  }

  @Get('support/tickets/:id')
  getMine(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.support.getForUser(userId, id);
  }

  @Post('support/tickets/:id/messages')
  message(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body(new ZodPipe(MessageDto)) body: z.infer<typeof MessageDto>,
  ) {
    return this.support.message(userId, id, body.text, false);
  }

  @Post('support/tickets/:id/close')
  close(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.support.close(userId, id, false);
  }

  // ---- staff ----
  @Roles('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  @Get('admin/tickets')
  listAll(@Query('status') status?: string) {
    return this.support.listAll(status);
  }

  @Roles('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  @Post('admin/tickets/:id/messages')
  reply(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body(new ZodPipe(MessageDto)) body: z.infer<typeof MessageDto>,
  ) {
    return this.support.message(userId, id, body.text, true);
  }

  @Roles('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  @Patch('admin/tickets/:id')
  async patch(@Param('id') id: string, @Body(new ZodPipe(AdminPatchDto)) body: z.infer<typeof AdminPatchDto>) {
    if (body.priority) await this.support.setPriority(id, body.priority);
    if (body.status) await this.support.setStatus(id, body.status);
    return { ok: true };
  }
}

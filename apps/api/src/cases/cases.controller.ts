import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CasesService } from './cases.service';
import { CurrentUser, Public } from '../common/decorators';
import { ZodPipe } from '../common/pipes/zod.pipe';

const OpenDto = z.object({
  count: z.number().int().min(1).max(5).default(1),
});

@ApiTags('cases')
@Controller()
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Public()
  @Get('cases')
  list(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('sort') sort?: string,
  ) {
    return this.cases.list({ q, category, sort });
  }

  @Public()
  @Get('cases/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.cases.bySlug(slug);
  }

  @Public()
  @Get('cases/:slug/odds')
  async odds(@Param('slug') slug: string) {
    const data = await this.cases.bySlug(slug);
    return CasesService.odds(data);
  }

  @Post('cases/:slug/open')
  open(
    @CurrentUser('id') userId: string,
    @Param('slug') slug: string,
    @Body(new ZodPipe(OpenDto)) body: z.infer<typeof OpenDto>,
  ) {
    return this.cases.open(userId, slug, body.count);
  }

  @Public()
  @Get('drops')
  drops(@Query('limit') limit?: string) {
    return this.cases.recentDrops(Number(limit) || 30);
  }
}

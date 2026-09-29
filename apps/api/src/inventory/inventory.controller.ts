import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { InventoryService } from './inventory.service';
import { CurrentUser } from '../common/decorators';
import { ZodPipe } from '../common/pipes/zod.pipe';

const SellDto = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });
const FavoriteDto = z.object({ isFavorite: z.boolean() });

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('rarity') rarity?: string,
    @Query('source') source?: string,
    @Query('search') search?: string,
    @Query('favorite') favorite?: string,
    @Query('sort') sort?: string,
  ) {
    return this.inventory.list(userId, {
      rarity,
      source,
      search,
      favorite: favorite === '1' || favorite === 'true',
      sort,
    });
  }

  @Patch(':id/favorite')
  favorite(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body(new ZodPipe(FavoriteDto)) body: z.infer<typeof FavoriteDto>,
  ) {
    return this.inventory.setFavorite(userId, id, body.isFavorite);
  }

  @Post('sell')
  sell(@CurrentUser('id') userId: string, @Body(new ZodPipe(SellDto)) body: z.infer<typeof SellDto>) {
    return this.inventory.sell(userId, body.ids);
  }
}

import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { USERNAME_RE } from '../auth/auth.dto';

const PatchMeDto = z
  .object({
    username: z.string().regex(USERNAME_RE).optional(),
    password: z.object({ current: z.string().min(1), next: z.string().min(6).max(120) }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty patch' });

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.users.me(userId);
  }

  @Patch('me')
  updateMe(@CurrentUser('id') userId: string, @Body(new ZodPipe(PatchMeDto)) body: z.infer<typeof PatchMeDto>) {
    return this.users.updateMe(userId, body);
  }

  @Get(':username')
  profile(@Param('username') username: string) {
    return this.users.publicProfile(username);
  }
}

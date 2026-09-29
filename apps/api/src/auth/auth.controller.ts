import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import type { LoginInput, RegisterInput } from './auth.dto';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { Public } from '../common/decorators';

function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== '0',
    path: '/',
    maxAge,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body(new ZodPipe(RegisterDto)) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.register(body);
    res.cookie('ca_at', tokens.accessToken, authCookieOptions(tokens.accessMaxAge * 1000));
    res.cookie('ca_rt', tokens.refreshToken, authCookieOptions(tokens.refreshMaxAge * 1000));
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(
    @Body(new ZodPipe(LoginDto)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'local';
    const tokens = await this.auth.login(body, ip);
    res.cookie('ca_at', tokens.accessToken, authCookieOptions(tokens.accessMaxAge * 1000));
    res.cookie('ca_rt', tokens.refreshToken, authCookieOptions(tokens.refreshMaxAge * 1000));
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.refresh(req.cookies?.['ca_rt']);
    res.cookie('ca_at', tokens.accessToken, authCookieOptions(tokens.accessMaxAge * 1000));
    res.cookie('ca_rt', tokens.refreshToken, authCookieOptions(tokens.refreshMaxAge * 1000));
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.['ca_rt']);
    res.clearCookie('ca_at', { path: '/' });
    res.clearCookie('ca_rt', { path: '/' });
    return { ok: true };
  }
}

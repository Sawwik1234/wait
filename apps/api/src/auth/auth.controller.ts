import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Logger, HttpStatus } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';
import { SteamService } from './steam.service';
import { LoginDto } from './auth.dto';
import type { LoginInput } from './auth.dto';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { Public } from '../common/decorators';
import { AppException } from '../common/app.exception';

function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== '0',
    path: '/',
    maxAge,
  };
}

function originOf(req: Request): string {
  const envOrigin = process.env.PUBLIC_ORIGIN?.trim();
  if (envOrigin) return envOrigin.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly steamSvc: SteamService,
  ) {}

  /**
   * Player entry point: redirect to Steam OpenID.
   * The browser goes to Steam and comes back to /api/auth/steam/callback.
   */
  @Public()
  @Get('steam')
  steam(@Req() req: Request, @Res() res: Response) {
    res.redirect(this.steamSvc.loginRedirect(originOf(req)));
  }

  @Public()
  @Get('steam/callback')
  async steamCallback(@Req() req: Request, @Res() res: Response) {
    const origin = originOf(req);
    const steamId = await this.steamSvc.verifyCallback(req.query as Record<string, string>);
    if (!steamId) {
      return res.redirect(`${origin}/login?steam=failed`);
    }
    const persona = await this.steamSvc.fetchPersona(steamId);
    const tokens = await this.auth.steamLogin(steamId, persona);
    res.cookie('ca_at', tokens.accessToken, authCookieOptions(tokens.accessMaxAge * 1000));
    res.cookie('ca_rt', tokens.refreshToken, authCookieOptions(tokens.refreshMaxAge * 1000));
    return res.redirect(`${origin}/cases?welcome=1`);
  }

  /**
   * DEV-ONLY local sign-in that skips Steam entirely (localhost testing when
   * steamcommunity.com is unreachable / flaky from the API process).
   * Hard-disabled in production (NODE_ENV=production → 404) and stripped from
   * the production web bundle, so players still enter via Steam only.
   */
  @Public()
  @Get('steam/dev')
  async steamDev(
    @Query('name') name: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppException('NOT_FOUND', 'Not found', HttpStatus.NOT_FOUND);
    }
    const clean = (name ?? 'DevPlayer').replace(/[^\wа-яА-ЯёЁ \-]/g, '').slice(0, 20) || 'DevPlayer';
    // Deterministic 17-digit steamId from the name → same name = same account.
    const hex = createHash('sha256').update(clean.toLowerCase()).digest('hex').slice(0, 8);
    const steamId = `76500000000${(parseInt(hex, 16) % 1_000_000).toString().padStart(6, '0')}`;
    this.logger.log(`[auth] DEV Steam-less sign-in: ${clean} (${steamId})`);
    const persona = await this.steamSvc.fetchPersona(steamId);
    const tokens = await this.auth.steamLogin(steamId, persona ?? clean);
    res.cookie('ca_at', tokens.accessToken, authCookieOptions(tokens.accessMaxAge * 1000));
    res.cookie('ca_rt', tokens.refreshToken, authCookieOptions(tokens.refreshMaxAge * 1000));
    return res.redirect(`${originOf(req)}/cases?welcome=1`);
  }

  /** Staff-only: email + password + secret admin code. */
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

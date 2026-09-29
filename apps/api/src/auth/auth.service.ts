import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { AppException } from '../common/app.exception';
import { ECONOMY } from '../common/economy';
import type { LoginInput } from './auth.dto';

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Tiny in-memory brute-force guard (per process; use Redis in clustered prod). */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly balance: BalanceService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Staff-only password login, protected by the secret admin code.
   * Regular players must use Steam (`/api/auth/steam`).
   */
  async login(input: LoginInput, ip: string) {
    // default matches docs/running-locally.md (dev only — override in production .env)
    const secretCode = (this.config.get<string>('ADMIN_SECRET_CODE', '') || 'ARENA-777-KEY').trim();
    if (input.code !== secretCode) {
      this.logger.warn(`[auth] wrong admin code from ${ip}`);
      throw new AppException('ADMIN_CODE_INVALID', 'Invalid secret code', HttpStatus.UNAUTHORIZED);
    }

    const key = `staff:${ip}:${input.email}`;
    const now = Date.now();
    const attempt = loginAttempts.get(key);
    if (attempt && attempt.count >= 8 && attempt.resetAt > now) {
      throw new AppException('RATE_LIMITED', 'Too many attempts, try later', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const isStaff = user && ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role);
    if (!user || !isStaff || !verifyPassword(input.password, user.passwordHash)) {
      const rec = attempt && attempt.resetAt > now ? attempt : { count: 0, resetAt: now + 60_000 };
      rec.count += 1;
      loginAttempts.set(key, rec);
      throw new AppException('BAD_CREDENTIALS', 'Wrong credentials', HttpStatus.UNAUTHORIZED);
    }
    loginAttempts.delete(key);
    return this.issueTokens(user.id, user.username, user.role);
  }

  /** Find-or-create the player behind a verified Steam ID; then issue tokens. */
  async steamLogin(steamId: string, personaName: string | null) {
    let user = await this.prisma.user.findUnique({ where: { steamId } });

    if (!user) {
      let username = (personaName ?? `SteamPlayer_${steamId.slice(-5)}`)
        .replace(/[^\wа-яА-ЯёЁ \-]/g, '')
        .slice(0, 20) || `Player_${steamId.slice(-4)}`;
      const existing = await this.prisma.user.findUnique({ where: { username } });
      if (existing) username = `${username.slice(0, 14)}_${steamId.slice(-3)}`;

      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: `steam_${steamId}@steam.local`,
            username,
            passwordHash: hashPassword(randomBytes(16).toString('hex')), // unusable password
            steamId,
          },
        });
        await tx.balance.create({ data: { userId: created.id, amount: ECONOMY.WELCOME_BONUS } });
        await tx.ledger.create({
          data: {
            userId: created.id,
            amount: ECONOMY.WELCOME_BONUS,
            type: 'WELCOME_BONUS',
            balanceAfter: ECONOMY.WELCOME_BONUS,
          },
        });
        await tx.notification.create({
          data: {
            userId: created.id,
            type: 'SYSTEM',
            title: 'Welcome to CaseArena!',
            body: `Signed in via Steam. You received ${ECONOMY.WELCOME_BONUS} AP — they have no real-money value.`,
          },
        });
        return created;
      });
      this.logger.log(`[auth] new Steam player: ${user.username} (${steamId})`);
    }

    return this.issueTokens(user.id, user.username, user.role);
  }

  /** Rotate refresh token: old session dies, a new one is born. */
  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw new AppException('TOKEN_INVALID', 'No refresh token', HttpStatus.UNAUTHORIZED);
    const hash = this.sha256(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash } });
    if (!session || session.expiresAt < new Date()) {
      throw new AppException('TOKEN_INVALID', 'Refresh session expired', HttpStatus.UNAUTHORIZED);
    }
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) throw new AppException('TOKEN_INVALID', 'User gone', HttpStatus.UNAUTHORIZED);

    await this.prisma.session.delete({ where: { id: session.id } });
    return this.issueTokens(user.id, user.username, user.role, session.userAgent ?? undefined);
  }

  async logout(refreshToken: string | undefined) {
    if (refreshToken) {
      await this.prisma.session
        .delete({ where: { refreshTokenHash: this.sha256(refreshToken) } })
        .catch(() => undefined);
    }
    return { ok: true };
  }

  private sha256(v: string): string {
    return createHash('sha256').update(v).digest('hex');
  }

  private async issueTokens(id: string, username: string, role: string, userAgent?: string) {
    const access = await this.jwt.signAsync(
      { sub: id, username, role },
      { expiresIn: ACCESS_TTL_SEC },
    );
    const jti = randomBytes(24).toString('hex');
    const refresh = await this.jwt.signAsync(
      { sub: id, jti },
      { expiresIn: `${REFRESH_DAYS}d` },
    );
    await this.prisma.session.create({
      data: {
        userId: id,
        refreshTokenHash: this.sha256(refresh),
        userAgent: userAgent ?? null,
        expiresAt: new Date(Date.now() + REFRESH_DAYS * 86_400_000),
      },
    });
    return {
      accessToken: access,
      refreshToken: refresh,
      accessMaxAge: ACCESS_TTL_SEC,
      refreshMaxAge: REFRESH_DAYS * 86_400,
    };
  }
}

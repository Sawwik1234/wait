import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators';

export interface AuthedUser {
  id: string;
  username: string;
  role: string;
  isBot: boolean;
}

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const req = ctx.switchToHttp().getRequest();
    const token: string | undefined =
      req.cookies?.['ca_at'] ?? this.bearer(req.headers?.authorization);

    if (!token) {
      if (isPublic) {
        req.user = null;
        return true;
      }
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Auth required' });
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, role: true, isBot: true },
      });
      if (!user) throw new Error('user gone');
      req.user = user as AuthedUser;
      return true;
    } catch {
      if (isPublic) {
        req.user = null;
        return true;
      }
      throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Invalid or expired token' });
    }
  }

  private bearer(header: string | undefined): string | undefined {
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app.exception';
import { levelFromXp, ECONOMY } from '../common/economy';
import { USERNAME_RE } from '../auth/auth.dto';
import { hashPassword, verifyPassword } from '../auth/auth.service';

const PUBLIC_USER = { id: true, username: true, xp: true, isBot: true, createdAt: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { balance: true },
    });
    if (!user) throw new AppException('NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);
    const { passwordHash: _ph, ...rest } = user;
    return { ...rest, level: levelFromXp(user.xp) };
  }

  async publicProfile(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { ...PUBLIC_USER, streak: true },
    });
    if (!user) throw new AppException('NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);

    const [invAgg, opens, upgradeWins, recent, best] = await Promise.all([
      this.prisma.inventoryItem.aggregate({
        where: { userId: user.id, status: 'OWNED' },
        _count: { _all: true },
      }),
      this.prisma.caseOpen.count({ where: { userId: user.id } }),
      this.prisma.upgrade.count({ where: { userId: user.id, success: true } }),
      this.prisma.caseOpen.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { item: true, case: { select: { name: true, slug: true } } },
      }),
      this.prisma.inventoryItem.findFirst({
        where: { userId: user.id, status: 'OWNED' },
        orderBy: { item: { value: 'desc' } },
        include: { item: true },
      }),
    ]);

    const ownedIds = await this.prisma.inventoryItem.findMany({
      where: { userId: user.id, status: 'OWNED' },
      select: { item: { select: { value: true } } },
    });
    const collectionValue = ownedIds.reduce((a, x) => a + x.item.value, 0);

    return {
      ...user,
      level: levelFromXp(user.xp),
      stats: {
        collectionCount: invAgg._count._all,
        collectionValue,
        opens,
        upgradeWins,
      },
      recent,
      bestItem: best?.item ?? null,
    };
  }

  async updateMe(userId: string, patch: { username?: string; password?: { current: string; next: string } }) {
    const data: { username?: string; passwordHash?: string } = {};

    if (patch.username) {
      if (!USERNAME_RE.test(patch.username)) {
        throw new AppException('VALIDATION', 'Invalid username');
      }
      const taken = await this.prisma.user.findUnique({ where: { username: patch.username } });
      if (taken && taken.id !== userId) {
        throw new AppException('USERNAME_TAKEN', 'Username already taken', HttpStatus.CONFLICT);
      }
      data.username = patch.username;
    }

    if (patch.password) {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (!verifyPassword(patch.password.current, user.passwordHash)) {
        throw new AppException('BAD_CREDENTIALS', 'Current password is wrong', HttpStatus.UNAUTHORIZED);
      }
      data.passwordHash = hashPassword(patch.password.next);
    }

    await this.prisma.user.update({ where: { id: userId }, data });
    return this.me(userId);
  }
}

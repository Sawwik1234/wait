import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { WrapInterceptor } from './common/interceptors/wrap.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

/**
 * Dev convenience (never runs in production): a fresh clone has no dev.db
 * (gitignored), which used to end with "The table main.User does not exist"
 * on the first login. If the schema is missing → create it and seed; if the
 * DB is simply empty → seed. After this, `npm run dev` always just works.
 */
async function ensureDevDatabase(app: { get: (t: new (...args: never[]) => PrismaService) => PrismaService }): Promise<void> {
  const prisma = app.get(PrismaService);
  const apiRoot = path.resolve(__dirname, '..'); // dist/main.js → apps/api

  let users: number | null = null;
  try {
    users = await prisma.user.count();
  } catch {
    users = null; // tables missing (P2021) or DB unreachable
  }

  if (users === null) {
    console.error('[api] ── База не инициализирована (свежий клон?). Создаю схему (prisma db push)…');
    spawnSync('npx prisma db push', { shell: true, stdio: 'inherit', cwd: apiRoot });
    console.error('[api] ── Сидирую базу (admin/demo/боты/кейсы/миссии/ачивки)…');
    spawnSync('npx tsx prisma/seed.ts', { shell: true, stdio: 'inherit', cwd: apiRoot });
  } else if (users === 0) {
    console.error('[api] ── В базе 0 пользователей. Сидирую (admin/demo/боты/кейсы)…');
    spawnSync('npx tsx prisma/seed.ts', { shell: true, stdio: 'inherit', cwd: apiRoot });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  const config = app.get(ConfigService);

  app.use(RequestIdMiddleware);
  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));

  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN', 'http://localhost:3000').split(','),
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new WrapInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CaseArena API')
    .setDescription(
      'CaseArena — social collection platform: cases, upgrades, contracts. ' +
        'Virtual currency (Arena Points) only, no real-money value.',
    )
    .setVersion('1.0')
    .addTag('auth')
    .addTag('users')
    .addTag('cases')
    .addTag('inventory')
    .addTag('upgrade')
    .addTag('contracts')
    .addTag('daily')
    .addTag('leaderboard')
    .addTag('stats')
    .addTag('notifications')
    .addTag('support')
    .addTag('admin')
    .addTag('health')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  if (process.env.NODE_ENV !== 'production') {
    await ensureDevDatabase(app);
  }

  const port = Number(config.get('PORT', 4000));
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[api] CaseArena API listening on http://0.0.0.0:${port} (docs: /docs)`);
}

void bootstrap();

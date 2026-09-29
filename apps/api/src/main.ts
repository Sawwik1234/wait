import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { WrapInterceptor } from './common/interceptors/wrap.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

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

  const port = Number(config.get('PORT', 4000));
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[api] CaseArena API listening on http://0.0.0.0:${port} (docs: /docs)`);
}

void bootstrap();

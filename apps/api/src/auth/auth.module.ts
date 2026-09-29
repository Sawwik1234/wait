import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SteamService } from './steam.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'casearena-dev-secret'),
        signOptions: { issuer: 'casearena' },
      }),
    }),
  ],
  providers: [AuthService, SteamService],
  controllers: [AuthController],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { UsersService } from '../users/users.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleOAuthService } from './google-oauth.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { VerificationTokenService } from './verification-token.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      // Global so the app-wide JwtAuthGuard can verify tokens.
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true }),
          algorithm: 'HS256',
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleOAuthService,
    PasswordService,
    SessionService,
    UsersService,
    VerificationTokenService,
  ],
  exports: [AuthService, UsersService],
})
export class AuthModule {}

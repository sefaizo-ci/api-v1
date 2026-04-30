import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';

import { SentinelController } from './sentinel.controller';
import { CreatePinHandler } from './interface/handler/create-pin.handler';
import { LoginHandler } from './interface/handler/login.handler';
import { RefreshTokenHandler } from './interface/handler/refresh-token.handler';
import { SendOtpHandler } from './interface/handler/send-otp.handler';
import { StartLoginHandler } from './interface/handler/start-login.handler';
import { VerifyOtpHandler } from './interface/handler/verify-otp.handler';
import { GetMeHandler } from './interface/queries/get-me.handler';
import { InitAuthFlowHandler } from './interface/queries/init-auth-flow.handler';

import { ApiKeyGuard } from './infrastructure/guards/api-key.guard';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from './infrastructure/guards/roles.guard';
import { OtpRepository } from './infrastructure/persistence/repositories/otp.repository';
import { RefreshTokenRepository } from './infrastructure/persistence/repositories/refresh-token.repository';
import { UserRepository } from './infrastructure/persistence/repositories/user.repository';

import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { LogoutHandler } from './interface/handler/logout.handler';
import { NotificationService } from './services/notification.service';
import { TokenService } from './services/token.service';

const CommandHandlers = [
  SendOtpHandler,
  StartLoginHandler,
  VerifyOtpHandler,
  CreatePinHandler,
  LoginHandler,
  RefreshTokenHandler,
  LogoutHandler,
];
const QueryHandlers = [GetMeHandler, InitAuthFlowHandler];

@Module({
  imports: [
    CqrsModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '15m') as StringValue,
        },
      }),
    }),
  ],
  controllers: [SentinelController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    JwtStrategy,
    ApiKeyGuard,
    JwtAuthGuard,
    RolesGuard,
    TokenService,
    { provide: 'IUserRepository', useClass: UserRepository },
    { provide: 'IOtpRepository', useClass: OtpRepository },
    { provide: 'IRefreshTokenRepository', useClass: RefreshTokenRepository },
    { provide: 'INotificationService', useClass: NotificationService },
  ],
  exports: ['IUserRepository', JwtAuthGuard, RolesGuard],
})
export class SentinelModule {}

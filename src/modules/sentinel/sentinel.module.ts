import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';

import { SentinelController } from './sentinel.controller';

import { AcceptTermsHandler } from './interface/handler/accept-terms.handler';
import { ChangePinHandler } from './interface/handler/change-pin.handler';
import { CompleteOnboardingHandler } from './interface/handler/complete-onboarding.handler';
import { CreatePinHandler } from './interface/handler/create-pin.handler';
import { SkipOnboardingStepHandler } from './interface/handler/skip-onboarding-step.handler';
import { UpdateUserProfileHandler } from './interface/handler/update-user-profile.handler';
import { LoginCompleteHandler } from './interface/handler/login-complete.handler';
import { LogoutHandler } from './interface/handler/logout.handler';
import { RefreshTokenHandler } from './interface/handler/refresh-token.handler';
import { RegisterPushTokenHandler } from './interface/handler/register-push-token.handler';
import { ResetPinHandler } from './interface/handler/reset-pin.handler';
import { RevokeSessionHandler } from './interface/handler/revoke-session.handler';
import { SendOtpHandler } from './interface/handler/send-otp.handler';
import { StartLoginHandler } from './interface/handler/start-login.handler';
import { VerifyOtpHandler } from './interface/handler/verify-otp.handler';

import { GetMeHandler } from './interface/queries/get-me.handler';
import { GetOnboardingMetaHandler } from './interface/queries/get-onboarding-meta.handler';
import { GetSessionsHandler } from './interface/queries/get-sessions.handler';
import { InitAuthFlowHandler } from './interface/queries/init-auth-flow.handler';

import { ApiKeyGuard } from './infrastructure/guards/api-key.guard';
import { ChallengeGuard } from './infrastructure/guards/challenge.guard';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from './infrastructure/guards/roles.guard';
import { OtpRepository } from './infrastructure/persistence/repositories/otp.repository';
import { RefreshTokenRepository } from './infrastructure/persistence/repositories/refresh-token.repository';
import { UserRepository } from './infrastructure/persistence/repositories/user.repository';

import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { NotificationService } from './services/notification.service';
import { ProfessionalEligibilityService } from './services/professional-eligibility.service';
import { TokenService } from './services/token.service';
import { PrismaService } from '../../libs/database/prisma.service';

const CommandHandlers = [
  AcceptTermsHandler,
  CompleteOnboardingHandler,
  SkipOnboardingStepHandler,
  UpdateUserProfileHandler,
  SendOtpHandler,
  StartLoginHandler,
  VerifyOtpHandler,
  CreatePinHandler,
  ResetPinHandler,
  ChangePinHandler,
  LoginCompleteHandler,
  RefreshTokenHandler,
  LogoutHandler,
  RevokeSessionHandler,
  RegisterPushTokenHandler,
];

const QueryHandlers = [
  GetMeHandler,
  GetOnboardingMetaHandler,
  GetSessionsHandler,
  InitAuthFlowHandler,
];

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
    ChallengeGuard,
    JwtAuthGuard,
    RolesGuard,
    TokenService,
    ProfessionalEligibilityService,
    PrismaService,
    { provide: 'IUserRepository', useClass: UserRepository },
    { provide: 'IOtpRepository', useClass: OtpRepository },
    { provide: 'IRefreshTokenRepository', useClass: RefreshTokenRepository },
    { provide: 'INotificationService', useClass: NotificationService },
  ],
  exports: [
    'IUserRepository',
    JwtAuthGuard,
    RolesGuard,
    ProfessionalEligibilityService,
  ],
})
export class SentinelModule {}

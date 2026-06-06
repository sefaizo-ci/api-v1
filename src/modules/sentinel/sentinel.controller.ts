import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UnauthorizedException } from '../../libs/exceptions/domain.exceptions';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AUTH } from '../../common/constants/routes';
import { extractIp } from '../../common/utils/request.util';
import { LOGIN_APPS, type LoginApp } from './core/enums/auth.enums';

type TokenResponse = { refreshToken: string };

import { AcceptTermsCommand } from './interface/commands/accept-terms.command';
import { ChangePinCommand } from './interface/commands/change-pin.command';
import { CompleteOnboardingCommand } from './interface/commands/complete-onboarding.command';
import { SkipOnboardingStepCommand } from './interface/commands/skip-onboarding-step.command';
import { GetOnboardingMetaQuery } from './interface/queries/get-onboarding-meta.query';
import { CreatePinCommand } from './interface/commands/create-pin.command';
import { LoginCompleteCommand } from './interface/commands/login-complete.command';
import { LogoutCommand } from './interface/commands/logout.command';
import { RefreshTokenCommand } from './interface/commands/refresh-token.command';
import { RegisterPushTokenCommand } from './interface/commands/register-push-token.command';
import { ResetPinCommand } from './interface/commands/reset-pin.command';
import { RevokeSessionCommand } from './interface/commands/revoke-session.command';
import { SendOtpCommand } from './interface/commands/send-otp.command';
import { StartLoginCommand } from './interface/commands/start-login.command';
import { UpdateUserProfileCommand } from './interface/commands/update-user-profile.command';
import { VerifyOtpCommand } from './interface/commands/verify-otp.command';
import { GetMeQuery } from './interface/queries/get-me.query';
import { GetSessionsQuery } from './interface/queries/get-sessions.query';
import { InitAuthFlowQuery } from './interface/queries/init-auth-flow.query';

import { ChangePinDto } from './interface/dtos/change-pin.dto';
import { CompleteRegistrationDto } from './interface/dtos/complete-registration.dto';
import { InitAuthFlowDto } from './interface/dtos/init-auth-flow.dto';
import { LoginCompleteDto } from './interface/dtos/login-complete.dto';
import { LogoutDto } from './interface/dtos/logout.dto';
import { RefreshTokenDto } from './interface/dtos/refresh-token.dto';
import { RegisterPushTokenDto } from './interface/dtos/register-push-token.dto';
import { ResetPinDto } from './interface/dtos/reset-pin.dto';
import { SendOtpDto } from './interface/dtos/send-otp.dto';
import { StartLoginDto } from './interface/dtos/start-login.dto';
import { UpdateUserProfileDto } from './interface/dtos/update-user-profile.dto';
import { VerifyOtpDto } from './interface/dtos/verify-otp.dto';

import { CurrentUser } from '../../libs/decorators/current-user.decorator';
import { Public } from '../../libs/decorators/public.decorator';
import { ChallengeGuard } from './infrastructure/guards/challenge.guard';

const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function resolveLoginApp(app: unknown): LoginApp {
  return LOGIN_APPS.includes(app as LoginApp) ? (app as LoginApp) : 'CLIENT';
}

function readRefreshTokenFromCookies(req?: Request): string | undefined {
  const rawCookieHeader = req?.headers?.cookie;
  if (typeof rawCookieHeader !== 'string' || rawCookieHeader.length === 0)
    return undefined;
  const cookieName = AUTH.COOKIE.REFRESH.NAME;
  const matched = rawCookieHeader
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${cookieName}=`));
  if (!matched) return undefined;
  return decodeURIComponent(matched.slice(cookieName.length + 1));
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(AUTH.COOKIE.REFRESH.NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: AUTH.COOKIE.REFRESH.PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

@Controller(AUTH.BASE)
@ApiTags('Sentinel')
@ApiSecurity('x-api-key')
export class SentinelController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(AUTH.FLOW.INIT)
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Initialize auth flow',
    description:
      'Returns nextStep: OTP (no account for this app) or PIN_THEN_OTP (existing account).',
  })
  @ApiBody({ type: InitAuthFlowDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        nextStep: { type: 'string', enum: ['PIN_THEN_OTP', 'OTP'] },
      },
      example: { nextStep: 'PIN_THEN_OTP' },
    },
  })
  initFlow(@Body() dto: InitAuthFlowDto) {
    return this.queryBus.execute(new InitAuthFlowQuery(dto.phone, dto.app));
  }

  @Post(AUTH.OTP.SEND)
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Send OTP',
    description: 'Send OTP for REGISTRATION or PIN_RESET.',
  })
  @ApiBody({ type: SendOtpDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { channel: { type: 'string', enum: ['WHATSAPP', 'SMS'] } },
      example: { channel: 'WHATSAPP' },
    },
  })
  sendOtp(@Body() dto: SendOtpDto, @Req() req: Request) {
    return this.commandBus.execute(
      new SendOtpCommand(
        dto.phone,
        dto.purpose,
        dto.app,
        req.headers['user-agent'],
        extractIp(req),
      ),
    );
  }

  @Post(AUTH.OTP.VERIFY)
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Verify OTP',
    description:
      'Verify OTP for REGISTRATION or PIN_RESET. Returns a challenge-only token (10 min) for the next step.',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        challengeToken: { type: 'string' },
        scope: { type: 'string', example: 'challenge-only' },
        expiresIn: { type: 'number', example: 600 },
      },
    },
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.commandBus.execute(
      new VerifyOtpCommand(dto.phone, dto.code, dto.purpose, dto.app),
    );
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  @Post(AUTH.PIN.CREATE)
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ChallengeGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Complete registration',
    description:
      'Requires challenge-only token from otp/verify (REGISTRATION). Creates the account + returns full tokens.',
  })
  @ApiBody({ type: CompleteRegistrationDto })
  async completeRegistration(
    @CurrentUser() challenge: { id: string; phone: string; app: LoginApp },
    @Body() dto: CompleteRegistrationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.commandBus.execute<
      CreatePinCommand,
      TokenResponse
    >(
      new CreatePinCommand(
        challenge.id,
        resolveLoginApp(challenge.app),
        dto.pin,
        dto.confirmPin,
        req.headers['user-agent'],
      ),
    );
    setRefreshCookie(res, result.refreshToken);
    return result;
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  @Post(AUTH.LOGIN.START)
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Start login (validate PIN)',
    description:
      'Validates PIN for the given app account, sends LOGIN OTP automatically. Returns a challenge-only token.',
  })
  @ApiBody({ type: StartLoginDto })
  startLogin(@Body() dto: StartLoginDto, @Req() req: Request) {
    return this.commandBus.execute(
      new StartLoginCommand(
        dto.phone,
        dto.pin,
        req.headers['user-agent'],
        resolveLoginApp(dto.app),
        extractIp(req),
      ),
    );
  }

  @Post(AUTH.LOGIN.COMPLETE)
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ChallengeGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Complete login (verify OTP)',
    description:
      'Requires challenge-only token from login/start. Verifies OTP and returns full access + refresh tokens.',
  })
  @ApiBody({ type: LoginCompleteDto })
  async loginComplete(
    @CurrentUser()
    challenge: { id: string; phone: string; app: LoginApp; userId: string },
    @Body() dto: LoginCompleteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.commandBus.execute<
      LoginCompleteCommand,
      TokenResponse
    >(
      new LoginCompleteCommand(
        challenge.userId,
        challenge.id,
        challenge.phone,
        resolveLoginApp(challenge.app),
        dto.code,
        req.headers['user-agent'],
        undefined,
        extractIp(req),
      ),
    );
    setRefreshCookie(res, result.refreshToken);
    return result;
  }

  // ─── PIN management ───────────────────────────────────────────────────────

  @Post(AUTH.PIN.RESET)
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ChallengeGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Reset PIN',
    description: 'Requires challenge-only token from otp/verify (PIN_RESET).',
  })
  @ApiBody({ type: ResetPinDto })
  resetPin(
    @CurrentUser() challenge: { userId: string },
    @Body() dto: ResetPinDto,
    @Req() req: Request,
  ) {
    return this.commandBus.execute(
      new ResetPinCommand(
        challenge.userId,
        dto.pin,
        dto.confirmPin,
        extractIp(req),
      ),
    );
  }

  @Post(AUTH.PIN.CHANGE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Change PIN (authenticated)',
    description: 'Change PIN while logged in.',
  })
  @ApiBody({ type: ChangePinDto })
  @ApiUnauthorizedResponse({
    description: 'Invalid current PIN or bearer token',
  })
  changePin(@CurrentUser() user: { id: string }, @Body() dto: ChangePinDto) {
    return this.commandBus.execute(
      new ChangePinCommand(
        user.id,
        dto.currentPin,
        dto.newPin,
        dto.confirmNewPin,
      ),
    );
  }

  // ─── Terms & Conditions ───────────────────────────────────────────────────

  @Post('terms/accept')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Accept terms & conditions',
    description:
      'Records the timestamp at which the user accepted the terms. Idempotent — calling it again has no effect if already accepted.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { acceptedTermsAt: { type: 'string', format: 'date-time' } },
    },
  })
  acceptTerms(@CurrentUser() user: { id: string }) {
    return this.commandBus.execute(new AcceptTermsCommand(user.id));
  }

  // ─── Token management ─────────────────────────────────────────────────────

  @Post(AUTH.TOKEN_REFRESH)
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh tokens',
    description: 'Rotate refresh token. From body or httpOnly cookie.',
  })
  @ApiBody({ type: RefreshTokenDto })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto.refreshToken ?? readRefreshTokenFromCookies(req);
    if (!refreshToken)
      throw new UnauthorizedException('Refresh token manquant.');

    const result = await this.commandBus.execute<
      RefreshTokenCommand,
      TokenResponse
    >(new RefreshTokenCommand(refreshToken));
    setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post(AUTH.LOGOUT)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout',
    description: 'Revoke current session or all sessions.',
  })
  @ApiBody({ type: LogoutDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  logout(
    @CurrentUser() user: { id: string },
    @Body() dto: LogoutDto,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const refreshToken = dto.refreshToken ?? readRefreshTokenFromCookies(req);
    res?.clearCookie(AUTH.COOKIE.REFRESH.NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: AUTH.COOKIE.REFRESH.PATH,
    });
    return this.commandBus.execute(
      new LogoutCommand(user.id, refreshToken, dto.allDevices),
    );
  }

  // ─── Me / Sessions / Push token ───────────────────────────────────────────

  @Get(AUTH.ME)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  getMe(@CurrentUser() user: { id: string }) {
    return this.queryBus.execute(new GetMeQuery(user.id));
  }

  @Patch(AUTH.ME_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user profile',
    description:
      'Update first name and/or last name. Returns updated profile and current onboarding step.',
  })
  @ApiBody({ type: UpdateUserProfileDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        onboardingStep: { type: 'string' },
      },
    },
  })
  updateMe(
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.commandBus.execute(
      new UpdateUserProfileCommand(
        user.id,
        user.role,
        dto.firstName,
        dto.lastName,
      ),
    );
  }

  @Post(AUTH.ONBOARDING_COMPLETE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Finalise onboarding',
    description:
      'Marks onboarding as complete. Requires all steps to be done (profile, terms, establishment, availability, services). Idempotent.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        onboardingCompletedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  completeOnboarding(@CurrentUser() user: { id: string; role: string }) {
    return this.commandBus.execute(
      new CompleteOnboardingCommand(user.id, user.role),
    );
  }

  @Get(AUTH.ONBOARDING)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get onboarding progress',
    description:
      'Returns the current onboarding step, completed steps, remaining steps, and publication status.',
  })
  getOnboardingMeta(@CurrentUser() user: { id: string; role: string }) {
    return this.queryBus.execute(
      new GetOnboardingMetaQuery(user.id, user.role),
    );
  }

  @Post(AUTH.ONBOARDING_STEP_SKIP)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Skip a non-blocking onboarding step',
    description:
      'Marks a step as skipped. Only non-blocking steps (localisation, disponibilites, galerie) can be skipped.',
  })
  skipOnboardingStep(
    @CurrentUser() user: { id: string; role: string },
    @Param('step') step: string,
  ) {
    return this.commandBus.execute(
      new SkipOnboardingStepCommand(user.id, step, user.role),
    );
  }

  @Get(AUTH.SESSIONS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  getSessions(@CurrentUser() user: { id: string }) {
    return this.queryBus.execute(new GetSessionsQuery(user.id));
  }

  @Delete(`${AUTH.SESSIONS}/:id`)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a session' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  revokeSession(
    @CurrentUser() user: { id: string },
    @Param('id') sessionId: string,
  ) {
    return this.commandBus.execute(
      new RevokeSessionCommand(user.id, sessionId),
    );
  }

  @Post(AUTH.PUSH_TOKEN)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register push notification token' })
  @ApiBody({ type: RegisterPushTokenDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  registerPushToken(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.commandBus.execute(
      new RegisterPushTokenCommand(
        user.id,
        dto.platform,
        dto.deviceId,
        dto.pushToken,
      ),
    );
  }
}

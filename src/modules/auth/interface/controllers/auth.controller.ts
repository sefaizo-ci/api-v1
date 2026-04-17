import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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
import type { Request, Response } from 'express';
import { AUTH } from '../../../../common/constants/routes';
import type { UserRole } from '../../core/enums/auth.enums';
import { OtpPurpose } from '../../core/enums/auth.enums';

import { CreatePinCommand } from '../commands/create-pin.command';
import { LogoutCommand } from '../commands/logout.command';
import { RefreshTokenCommand } from '../commands/refresh-token.command';
import { SendOtpCommand } from '../commands/send-otp.command';
import { StartLoginCommand } from '../commands/start-login.command';
import { VerifyOtpCommand } from '../commands/verify-otp.command';
import { GetMeQuery } from '../queries/get-me.query';
import { InitAuthFlowQuery } from '../queries/init-auth-flow.query';

import { CompleteRegistrationDto } from '../dtos/complete-registration.dto';
import { InitAuthFlowDto } from '../dtos/init-auth-flow.dto';
import { LogoutDto } from '../dtos/logout.dto';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { SendOtpDto } from '../dtos/send-otp.dto';
import { StartLoginDto } from '../dtos/start-login.dto';
import { VerifyOtpDto } from '../dtos/verify-otp.dto';

import { CurrentUser } from '../../../../libs/decorators/current-user.decorator';
import { ApiKeyGuard } from '../../infrastructure/guards/api-key.guard';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';

const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function readRefreshTokenFromCookies(req?: Request): string | undefined {
  const rawCookieHeader = req?.headers?.cookie;

  if (typeof rawCookieHeader !== 'string' || rawCookieHeader.length === 0) {
    return undefined;
  }

  const cookieName = AUTH.COOKIE.REFRESH.NAME;
  const matched = rawCookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));

  if (!matched) {
    return undefined;
  }

  return decodeURIComponent(matched.slice(cookieName.length + 1));
}

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

type VerifyOtpResponse = {
  userId: string;
  isNewUser: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    phone: string;
    firstName: string;
    role: UserRole;
  };
};

@Controller(AUTH.BASE)
@ApiTags('Auth')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(AUTH.FLOW.INIT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initialize auth flow by phone',
    description:
      'Detect whether the phone has an existing active account with PIN configured.',
  })
  @ApiBody({ type: InitAuthFlowDto })
  @ApiOkResponse({
    description: 'Auth flow decision',
    schema: {
      type: 'object',
      properties: {
        hasAccount: { type: 'boolean' },
        nextStep: { type: 'string', enum: ['PIN_THEN_OTP', 'OTP'] },
      },
      example: { hasAccount: true, nextStep: 'PIN_THEN_OTP' },
    },
  })
  initFlow(@Body() dto: InitAuthFlowDto) {
    return this.queryBus.execute(new InitAuthFlowQuery(dto.phone));
  }

  @Post(AUTH.OTP.SEND)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send OTP',
    description:
      'Send OTP for registration or PIN reset. LOGIN OTP is started via /auth/login/start after PIN validation.',
  })
  @ApiBody({ type: SendOtpDto })
  @ApiOkResponse({
    description: 'OTP sent successfully',
    schema: {
      type: 'object',
      properties: {
        channel: { type: 'string', enum: ['WHATSAPP', 'SMS'] },
      },
      example: { channel: 'WHATSAPP' },
    },
  })
  sendOtp(@Body() dto: SendOtpDto, @Req() req: Request) {
    return this.commandBus.execute(
      new SendOtpCommand(dto.phone, dto.purpose, req.headers['user-agent']),
    );
  }

  @Post(AUTH.OTP.VERIFY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP',
    description: 'Verify OTP code and return user onboarding state.',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({
    description:
      'OTP verified successfully (registration branch or login branch)',
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            isNewUser: { type: 'boolean' },
          },
          example: {
            userId: '3f588642-25d6-4d73-8ec8-55a5f95a892a',
            isNewUser: true,
          },
        },
        {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            isNewUser: { type: 'boolean' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                phone: { type: 'string' },
                firstName: { type: 'string' },
                role: {
                  type: 'string',
                  enum: ['CLIENT', 'PROFESSIONAL', 'ADMIN'],
                },
              },
            },
          },
          example: {
            userId: '3f588642-25d6-4d73-8ec8-55a5f95a892a',
            isNewUser: false,
            accessToken: 'jwt_access_token',
            refreshToken: 'raw_refresh_token',
            user: {
              id: '3f588642-25d6-4d73-8ec8-55a5f95a892a',
              phone: '+2250700000000',
              firstName: 'Aya',
              role: 'CLIENT',
            },
          },
        },
      ],
    },
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result: VerifyOtpResponse = await this.commandBus.execute(
      new VerifyOtpCommand(dto.phone, dto.code, dto.purpose),
    );

    if (dto.purpose === OtpPurpose.LOGIN && result.refreshToken) {
      res.cookie(AUTH.COOKIE.REFRESH.NAME, result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: AUTH.COOKIE.REFRESH.PATH,
        maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      });
    }

    return result;
  }

  @Post(AUTH.REGISTER.COMPLETE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Complete registration',
    description: 'Set PIN and profile data after OTP verification.',
  })
  @ApiBody({ type: CompleteRegistrationDto })
  @ApiOkResponse({
    description: 'Registration completed successfully',
    schema: {
      type: 'object',
      nullable: true,
      example: null,
    },
  })
  completeRegistration(@Body() dto: CompleteRegistrationDto) {
    return this.commandBus.execute(
      new CreatePinCommand(
        dto.userId,
        dto.pin,
        dto.confirmPin,
        dto.firstName,
        dto.lastName,
      ),
    );
  }

  @Post(AUTH.LOGIN.START)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start existing-user login challenge',
    description:
      'Validate phone + PIN, then send LOGIN OTP. Tokens are returned only after /auth/otp/verify with purpose=LOGIN.',
  })
  @ApiBody({ type: StartLoginDto })
  @ApiOkResponse({
    description: 'LOGIN OTP challenge started',
    schema: {
      type: 'object',
      properties: {
        channel: { type: 'string', enum: ['WHATSAPP', 'SMS'] },
      },
      example: {
        channel: 'WHATSAPP',
      },
    },
  })
  startLogin(@Body() dto: StartLoginDto, @Req() req: Request) {
    return this.commandBus.execute(
      new StartLoginCommand(dto.phone, dto.pin, req.headers['user-agent']),
    );
  }

  @Post(AUTH.TOKEN_REFRESH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh tokens',
    description:
      'Rotate refresh token and return a new access token. Refresh token can come from body or cookie.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: 'Tokens refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
      example: {
        accessToken: 'new_jwt_access_token',
        refreshToken: 'new_raw_refresh_token',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid refresh token' })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto.refreshToken ?? readRefreshTokenFromCookies(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token manquant.');
    }

    const result: RefreshResponse = await this.commandBus.execute(
      new RefreshTokenCommand(refreshToken),
    );

    res.cookie(AUTH.COOKIE.REFRESH.NAME, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: AUTH.COOKIE.REFRESH.PATH,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });

    return result;
  }

  @Post(AUTH.LOGOUT)
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout',
    description: 'Logout current session or all sessions with allDevices=true.',
  })
  @ApiBody({ type: LogoutDto })
  @ApiOkResponse({
    description: 'Logout processed',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      example: { message: 'Déconnecté avec succès.' },
    },
  })
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

  @Get(AUTH.ME)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user',
    description: 'Return authenticated user profile.',
  })
  @ApiOkResponse({
    description: 'Current user profile',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        phone: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        role: { type: 'string', enum: ['CLIENT', 'PROFESSIONAL', 'ADMIN'] },
        isVerified: { type: 'boolean' },
      },
      example: {
        id: '3f588642-25d6-4d73-8ec8-55a5f95a892a',
        phone: '+2250700000000',
        firstName: 'Aya',
        lastName: 'Kouame',
        role: 'CLIENT',
        isVerified: true,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  getMe(@CurrentUser() user: { id: string }) {
    return this.queryBus.execute(new GetMeQuery(user.id));
  }
}

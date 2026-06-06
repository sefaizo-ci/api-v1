import {
  BadRequestException,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OtpPurpose } from '../../core/enums/auth.enums';
import type { IOtpRepository } from '../../core/services/otp.service.interface';
import type { IRefreshTokenRepository } from '../../core/services/refresh-token.service.interface';
import type { IUserRepository, OnboardingMeta } from '../../core/services/user.service.interface';
import { TokenService } from '../../services/token.service';
import { LoginCompleteCommand } from '../commands/login-complete.command';

function extractPlatform(userAgent?: string): string {
  if (!userAgent) return 'UNKNOWN';
  const ua = userAgent.toLowerCase();
  if (ua.includes('android')) return 'ANDROID';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'IOS';
  if (ua.includes('windows')) return 'WINDOWS';
  if (ua.includes('mac')) return 'MAC';
  return 'WEB';
}

type LoginCompleteResult = {
  accessToken: string;
  refreshToken: string;
  professionalId: string | null;
  clientId: string | null;
  user: {
    id: string;
    phone: string;
    firstName: string;
    app: string;
    hasAcceptedTerms: boolean;
    acceptedTermsAt: string | null;
    onboarding: OnboardingMeta | null;
  };
};

@CommandHandler(LoginCompleteCommand)
export class LoginCompleteHandler implements ICommandHandler<LoginCompleteCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IOtpRepository') private readonly otpRepo: IOtpRepository,
    @Inject('IRefreshTokenRepository')
    private readonly refreshRepo: IRefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(cmd: LoginCompleteCommand): Promise<LoginCompleteResult> {
    const user = await this.userRepo.findById(cmd.userId);
    if (!user || !user.isAccountActive())
      throw new UnauthorizedException('Compte désactivé.');

    const otp = await this.otpRepo.findLatestValid(
      cmd.phoneId,
      OtpPurpose.LOGIN,
      cmd.app,
    );
    if (!otp || otp.isUsed) {
      throw new BadRequestException(
        'Aucun code valide. Demandez un nouveau code.',
      );
    }
    if (otp.isBlocked())
      throw new UnauthorizedException(
        'Trop de tentatives. Réessayez dans 1 heure.',
      );
    if (otp.isExpired())
      throw new BadRequestException('Code expiré. Demandez un nouveau code.');

    const isValid = await bcrypt.compare(cmd.code, otp.code);
    if (!isValid) {
      await this.otpRepo.incrementFail(otp.id);
      if (otp.hasReachedMaxAttempts()) {
        await this.otpRepo.blockOtp(
          otp.id,
          new Date(Date.now() + 60 * 60 * 1000),
        );
        throw new UnauthorizedException('Trop de tentatives. Bloqué 1 heure.');
      }
      throw new UnauthorizedException(
        `Code incorrect. ${otp.remainingAttempts() - 1} tentative(s) restante(s).`,
      );
    }

    await this.otpRepo.markUsed(otp.id);

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      phone: user.phone,
      role: cmd.app,
    });
    const { raw, hash } = this.tokenService.generateRefreshToken();
    const platform = extractPlatform(cmd.deviceInfo);

    const { id: tokenId } = await this.refreshRepo.create({
      userId: user.id,
      tokenHash: hash,
      deviceInfo: cmd.deviceInfo,
      ipAddress: cmd.ipAddress,
      platform,
      metadata: { source: 'login_complete', app: cmd.app },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const fingerprint = cmd.deviceId
      ? crypto.createHash('sha256').update(cmd.deviceId).digest('hex')
      : crypto
          .createHash('sha256')
          .update(cmd.deviceInfo ?? 'unknown')
          .digest('hex');

    const deviceId = await this.userRepo.upsertDevice({
      userId: user.id,
      fingerprint,
      platform,
      model: cmd.deviceInfo?.substring(0, 255),
    });

    await this.userRepo.createDeviceAuth({
      deviceId,
      userId: user.id,
      refreshTokenId: tokenId,
    });

    await this.userRepo.logAuthEvent({
      event: 'LOGIN_SUCCESS',
      userId: user.id,
      deviceInfo: cmd.deviceInfo,
      ipAddress: cmd.ipAddress,
      metadata: { app: cmd.app },
    });

    const onboarding =
      cmd.app === 'PROFESSIONAL'
        ? await this.userRepo.getOnboardingMeta(user.id)
        : null;
    const termsDate: Date | null = user.acceptedTermsAt;
    const acceptedTermsAt: string | null =
      termsDate instanceof Date ? termsDate.toISOString() : null;

    const professionalId =
      cmd.app === 'PROFESSIONAL'
        ? await this.userRepo.getProfessionalId(user.id)
        : null;
    const clientId = cmd.app === 'CLIENT' ? user.id : null;

    return {
      accessToken,
      refreshToken: raw,
      professionalId,
      clientId,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        app: cmd.app,
        hasAcceptedTerms: acceptedTermsAt !== null,
        acceptedTermsAt,
        onboarding,
      },
    };
  }
}

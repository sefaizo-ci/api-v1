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
import type { IUserRepository } from '../../core/services/user.service.interface';
import { TokenService } from '../../services/token.service';
import { VerifyOtpCommand } from '../commands/verify-otp.command';
import { withAuthFlowMetadata } from '../utils/auth-metadata.util';

type VerifyOtpResult = {
  userId: string;
  isNewUser: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    phone: string;
    firstName: string;
    role: string;
    roles: string[];
  };
};

function extractPlatform(userAgent?: string): string {
  if (!userAgent) return 'UNKNOWN';
  const ua = userAgent.toLowerCase();
  if (ua.includes('android')) return 'ANDROID';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'IOS';
  if (ua.includes('windows')) return 'WINDOWS';
  if (ua.includes('mac')) return 'MAC';
  return 'WEB';
}

@CommandHandler(VerifyOtpCommand)
export class VerifyOtpHandler implements ICommandHandler<VerifyOtpCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IOtpRepository') private readonly otpRepo: IOtpRepository,
    @Inject('IRefreshTokenRepository')
    private readonly refreshRepo: IRefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(cmd: VerifyOtpCommand): Promise<VerifyOtpResult> {
    const user = await this.userRepo.findByPhone(cmd.phone);
    if (!user) throw new BadRequestException('Numéro introuvable.');

    const otp = await this.otpRepo.findLatestValid(
      user.id,
      cmd.purpose,
      cmd.purpose === OtpPurpose.LOGIN ? cmd.app : undefined,
    );
    if (!otp || otp.isUsed)
      throw new BadRequestException(
        'Aucun code valide. Demandez un nouveau code.',
      );

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

    if (cmd.purpose === OtpPurpose.LOGIN) {
      if (!user.isAccountActive()) {
        throw new UnauthorizedException('Compte désactivé.');
      }
      if (!user.hasPin()) {
        throw new UnauthorizedException('PIN non configuré.');
      }

      const roles = await this.userRepo.getRolesByUserId(user.id);
      if (!roles.includes(cmd.app)) {
        throw new UnauthorizedException(
          `Ce compte ne possède pas le profil ${cmd.app}.`,
        );
      }

      const primaryRole = cmd.app;

      const accessToken = this.tokenService.generateAccessToken({
        sub: user.id,
        phone: user.phone,
        role: primaryRole,
        roles,
      });
      const { raw, hash } = this.tokenService.generateRefreshToken();

      const fingerprint = crypto
        .createHash('sha256')
        .update(cmd.deviceInfo ?? 'unknown')
        .digest('hex');
      const platform = extractPlatform(cmd.deviceInfo);

      const { id: tokenId } = await this.refreshRepo.create({
        userId: user.id,
        tokenHash: hash,
        deviceInfo: cmd.deviceInfo,
        platform,
        metadata: {
          source: 'verify_otp_login',
          otpId: otp.id,
          app: cmd.app,
        },
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

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
        metadata: { app: cmd.app, otpId: otp.id },
      });

      await this.userRepo.updateMetadata(
        user.id,
        withAuthFlowMetadata(user.metadata, {
          status: 'ACTIVE',
          currentStep: 'AUTHENTICATED',
          lastLoginAt: new Date().toISOString(),
          otpPurpose: OtpPurpose.LOGIN,
          app: cmd.app,
        }),
      );

      return {
        userId: user.id,
        isNewUser: false,
        accessToken,
        refreshToken: raw,
        user: {
          id: user.id,
          phone: user.phone,
          firstName: user.firstName,
          role: primaryRole,
          roles,
        },
      };
    }

    const isNewUser = !user.isVerified;
    if (isNewUser && cmd.purpose === OtpPurpose.REGISTRATION) {
      await this.userRepo.markVerified(user.id);

      await this.userRepo.logAuthEvent({
        event: 'OTP_VERIFIED',
        userId: user.id,
        deviceInfo: cmd.deviceInfo,
        metadata: { purpose: OtpPurpose.REGISTRATION },
      });

      await this.userRepo.updateMetadata(
        user.id,
        withAuthFlowMetadata(user.metadata, {
          status: 'ONBOARDING',
          currentStep: 'OTP_VERIFIED',
          otpPurpose: OtpPurpose.REGISTRATION,
        }),
      );
    }

    return { userId: user.id, isNewUser };
  }
}

import {
  BadRequestException,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
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

    const otp = await this.otpRepo.findLatestValid(user.id, cmd.purpose);
    if (!otp)
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
      const primaryRole = roles[0] ?? user.role;

      const accessToken = this.tokenService.generateAccessToken({
        sub: user.id,
        phone: user.phone,
        role: primaryRole,
        roles,
      });
      const { raw, hash } = this.tokenService.generateRefreshToken();
      await this.refreshRepo.create({
        userId: user.id,
        tokenHash: hash,
        metadata: {
          source: 'verify_otp_login',
          otpId: otp.id,
        },
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await this.userRepo.updateMetadata(
        user.id,
        withAuthFlowMetadata(user.metadata, {
          status: 'ACTIVE',
          currentStep: 'AUTHENTICATED',
          lastLoginAt: new Date().toISOString(),
          otpPurpose: OtpPurpose.LOGIN,
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

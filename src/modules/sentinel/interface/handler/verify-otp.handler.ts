import { Inject } from '@nestjs/common';
import {
  BadRequestException,
  UnauthorizedException,
} from '../../../../libs/exceptions/domain.exceptions';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import { OtpPurpose } from '../../core/enums/auth.enums';
import type { IOtpRepository } from '../../core/services/otp.service.interface';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { TokenService } from '../../services/token.service';
import { VerifyOtpCommand } from '../commands/verify-otp.command';

type VerifyOtpResult = {
  challengeToken: string;
  scope: 'challenge-only';
  expiresIn: number;
};

@CommandHandler(VerifyOtpCommand)
export class VerifyOtpHandler implements ICommandHandler<VerifyOtpCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IOtpRepository') private readonly otpRepo: IOtpRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(cmd: VerifyOtpCommand): Promise<VerifyOtpResult> {
    const phoneRecord = await this.userRepo.findPhoneByNumber(cmd.phone);
    if (!phoneRecord) throw new BadRequestException('Numéro introuvable.');

    const otp = await this.otpRepo.findLatestValid(
      phoneRecord.id,
      cmd.purpose,
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

    if (cmd.purpose === OtpPurpose.REGISTRATION) {
      await this.userRepo.markPhoneVerified(phoneRecord.id);
      return {
        challengeToken: this.tokenService.generateChallengeToken({
          phoneId: phoneRecord.id,
          phone: cmd.phone,
          purpose: cmd.purpose,
          app: cmd.app,
        }),
        scope: 'challenge-only',
        expiresIn: 600,
      };
    }

    // PIN_RESET — userId required for the reset step
    const user = await this.userRepo.findByPhone(cmd.phone, cmd.app);
    if (!user || !user.isAccountActive())
      throw new BadRequestException('Compte introuvable.');

    return {
      challengeToken: this.tokenService.generateChallengeToken({
        phoneId: phoneRecord.id,
        phone: cmd.phone,
        purpose: cmd.purpose,
        app: cmd.app,
        userId: user.id,
      }),
      scope: 'challenge-only',
      expiresIn: 600,
    };
  }
}

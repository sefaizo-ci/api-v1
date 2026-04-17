import {
  BadRequestException,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OtpPurpose, type OtpChannel } from '../../core/enums/auth.enums';
import type { INotificationService } from '../../core/services/notification.service.interface';
import type { IOtpRepository } from '../../core/services/otp.service.interface';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { StartLoginCommand } from '../commands/start-login.command';
import { withAuthFlowMetadata } from '../utils/auth-metadata.util';

@CommandHandler(StartLoginCommand)
export class StartLoginHandler implements ICommandHandler<StartLoginCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IOtpRepository') private readonly otpRepo: IOtpRepository,
    @Inject('INotificationService')
    private readonly notif: INotificationService,
  ) {}

  async execute(cmd: StartLoginCommand): Promise<{ channel: OtpChannel }> {
    const user = await this.userRepo.findByPhone(cmd.phone);
    if (!user || !user.isAccountActive()) {
      throw new BadRequestException('Numéro introuvable.');
    }
    if (!user.hasPin()) {
      throw new UnauthorizedException('PIN non configuré.');
    }
    if (user.isPinBlocked()) {
      throw new UnauthorizedException('PIN bloqué 1 heure.');
    }

    const pinValid = await bcrypt.compare(cmd.pin, user.pinHash!);
    if (!pinValid) {
      await this.userRepo.incrementPinFail(user.id);
      if (user.pinRemainingAttempts() <= 1) {
        await this.userRepo.blockPin(
          user.id,
          new Date(Date.now() + 60 * 60 * 1000),
        );
        throw new UnauthorizedException(
          'Trop de tentatives. PIN bloqué 1 heure.',
        );
      }
      throw new UnauthorizedException(
        `PIN incorrect. ${user.pinRemainingAttempts() - 1} tentative(s) restante(s).`,
      );
    }

    await this.userRepo.resetPinFail(user.id);
    await this.otpRepo.invalidatePrevious(user.id, OtpPurpose.LOGIN);

    const rawCode = crypto.randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(rawCode, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    console.log(
      `OTP for ${cmd.phone} (purpose: ${OtpPurpose.LOGIN}): ${rawCode}`,
    );

    const channel = await this.notif.sendOtp(cmd.phone, rawCode);
    await this.otpRepo.create({
      userId: user.id,
      code: codeHash,
      purpose: OtpPurpose.LOGIN,
      channel,
      metadata: {
        source: 'start_login',
        deviceInfo: cmd.deviceInfo ?? null,
      },
      expiresAt,
    });

    await this.userRepo.updateMetadata(
      user.id,
      withAuthFlowMetadata(user.metadata, {
        status: 'ACTIVE',
        currentStep: 'LOGIN_OTP_SENT',
        otpPurpose: OtpPurpose.LOGIN,
      }),
    );

    return { channel };
  }
}

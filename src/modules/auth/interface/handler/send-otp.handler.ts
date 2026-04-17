import { BadRequestException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OtpPurpose, type OtpChannel } from '../../core/enums/auth.enums';
import type { INotificationService } from '../../core/services/notification.service.interface';
import type { IOtpRepository } from '../../core/services/otp.service.interface';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { SendOtpCommand } from '../commands/send-otp.command';
import { withAuthFlowMetadata } from '../utils/auth-metadata.util';

@CommandHandler(SendOtpCommand)
export class SendOtpHandler implements ICommandHandler<SendOtpCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IOtpRepository') private readonly otpRepo: IOtpRepository,
    @Inject('INotificationService')
    private readonly notif: INotificationService,
  ) {}

  async execute(cmd: SendOtpCommand): Promise<{ channel: OtpChannel }> {
    const { phone, purpose } = cmd;

    let user = await this.userRepo.findByPhone(phone);

    if (
      purpose === OtpPurpose.REGISTRATION &&
      user &&
      user.hasPin() &&
      user.isAccountActive()
    ) {
      throw new BadRequestException('Ce numéro est déjà enregistré.');
    }
    if (purpose !== OtpPurpose.REGISTRATION && !user) {
      throw new BadRequestException('Numéro introuvable.');
    }

    if (!user) {
      user = await this.userRepo.create({
        phone,
        firstName: '',
        lastName: '',
        metadata: {
          source: 'send_otp',
          purpose,
          createdAt: new Date().toISOString(),
        },
      });
    }

    await this.otpRepo.invalidatePrevious(user.id, purpose);

    const rawCode = crypto.randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(rawCode, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const channel = await this.notif.sendOtp(phone, rawCode);

    // confirm OTP sending before saving to DB

    await this.otpRepo.create({
      userId: user.id,
      code: codeHash,
      purpose,
      channel,
      metadata: {
        source: 'send_otp',
        purpose,
        deviceInfo: cmd.deviceInfo ?? null,
      },
      expiresAt,
    });

    await this.userRepo.updateMetadata(
      user.id,
      withAuthFlowMetadata(user.metadata, {
        status: purpose === OtpPurpose.PIN_RESET ? 'ACTIVE' : 'ONBOARDING',
        currentStep:
          purpose === OtpPurpose.PIN_RESET ? 'PIN_RESET_OTP_SENT' : 'OTP_SENT',
        otpPurpose: purpose,
      }),
    );

    return { channel };
  }
}

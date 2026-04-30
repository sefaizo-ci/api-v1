import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RedisService } from '../../../../libs/redis/redis.service';
import { OtpChannel, OtpPurpose } from '../../core/enums/auth.enums';
import type { INotificationService } from '../../core/services/notification.service.interface';
import type { IOtpRepository } from '../../core/services/otp.service.interface';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { SendOtpCommand } from '../commands/send-otp.command';
import { withAuthFlowMetadata } from '../utils/auth-metadata.util';

const OTP_SEND_COOLDOWN_SECONDS = 60;
const OTP_SEND_RATE_WINDOW_SECONDS = 15 * 60;
const OTP_SEND_MAX_ATTEMPTS_PER_WINDOW = 5;

@CommandHandler(SendOtpCommand)
export class SendOtpHandler implements ICommandHandler<SendOtpCommand> {
  private readonly logger = new Logger(SendOtpHandler.name);

  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IOtpRepository') private readonly otpRepo: IOtpRepository,
    @Inject('INotificationService')
    private readonly notif: INotificationService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private isDevModeEnabled(): boolean {
    const value = this.configService.get<string>('OTP_DEV_MODE') ?? 'false';
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  async execute(cmd: SendOtpCommand): Promise<{ channel: OtpChannel }> {
    const { phone, purpose } = cmd;

    await this.enforceRateLimit(phone, purpose);

    let user = await this.userRepo.findByPhone(phone);

    if (
      purpose === OtpPurpose.REGISTRATION &&
      user &&
      user.hasPin() &&
      user.isAccountActive() &&
      user.deletedAt === null
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

    await this.otpRepo.invalidatePrevious(
      user.id,
      purpose,
      'new OTP requested',
    );

    const devMode = this.isDevModeEnabled();
    const rawCode = devMode
      ? '000000'
      : crypto.randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(rawCode, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let channel: OtpChannel;
    if (devMode) {
      this.logger.warn(
        `[OTP_DEV_MODE] code=000000 skipping notification for phone=${phone}`,
      );
      channel = OtpChannel.SMS;
    } else {
      channel = await this.notif.sendOtp(phone, rawCode);
    }

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

    await this.storeCooldown(phone, purpose);

    return { channel };
  }

  private buildCooldownKey(phone: string, purpose: OtpPurpose): string {
    return `auth:otp:cooldown:${purpose}:${phone}`;
  }

  private buildAttemptsKey(phone: string, purpose: OtpPurpose): string {
    return `auth:otp:attempts:${purpose}:${phone}`;
  }

  private async enforceRateLimit(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const cooldownKey = this.buildCooldownKey(phone, purpose);
    const attemptsKey = this.buildAttemptsKey(phone, purpose);

    try {
      const hasCooldown = await this.redisService.exists(cooldownKey);
      if (hasCooldown) {
        const ttl = Math.max(await this.redisService.ttl(cooldownKey), 1);
        throw new HttpException(
          `Patientez ${ttl}s avant de redemander un code.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const attempts = await this.redisService.incrementWithWindow(
        attemptsKey,
        OTP_SEND_RATE_WINDOW_SECONDS,
      );
      if (attempts > OTP_SEND_MAX_ATTEMPTS_PER_WINDOW) {
        const ttl = Math.max(await this.redisService.ttl(attemptsKey), 1);
        throw new HttpException(
          `Trop de demandes OTP. Réessayez dans ${ttl}s.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 429) {
        throw error;
      }

      this.logger.warn(
        'Redis indisponible, OTP envoyé sans contrôle anti-spam temporairement.',
      );
    }
  }

  private async storeCooldown(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const cooldownKey = this.buildCooldownKey(phone, purpose);

    try {
      await this.redisService.setWithExpiry(
        cooldownKey,
        '1',
        OTP_SEND_COOLDOWN_SECONDS,
      );
    } catch (error) {
      this.logger.warn(
        `Impossible d'écrire le cooldown OTP dans Redis: ${(error as Error).message}`,
      );
    }
  }
}

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

  private isActiveRegisteredUser(
    user: Awaited<ReturnType<IUserRepository['findById']>>,
  ): boolean {
    return Boolean(user && user.hasPin() && user.isAccountActive());
  }

  private isTooManyRequestsError(error: unknown): boolean {
    return (
      error instanceof HttpException &&
      error.getStatus() === (HttpStatus.TOO_MANY_REQUESTS as number)
    );
  }

  async execute(cmd: SendOtpCommand): Promise<{ channel: OtpChannel }> {
    const { phone, purpose, app } = cmd;

    await this.enforceRateLimit(phone, purpose);

    // Find or create the PhoneNumber record (never creates a User here)
    const phoneRecord = await this.userRepo.findOrCreatePhone(phone);

    if (purpose === OtpPurpose.REGISTRATION) {
      // Reject if an active account already exists for this app
      const slotTaken =
        app === 'CLIENT'
          ? phoneRecord.clientUserId
          : phoneRecord.professionalUserId;

      if (slotTaken) {
        const user = await this.userRepo.findById(slotTaken);
        if (this.isActiveRegisteredUser(user)) {
          throw new BadRequestException(
            `Un compte ${app} existe déjà pour ce numéro.`,
          );
        }
      }
    }

    if (purpose === OtpPurpose.PIN_RESET) {
      const user = await this.userRepo.findByPhone(phone, app);
      if (!user || !user.isAccountActive()) {
        throw new BadRequestException('Numéro introuvable.');
      }
    }

    await this.otpRepo.invalidatePrevious(phoneRecord.id, purpose, app);

    const devMode = this.isDevModeEnabled();
    const rawCode = devMode ? '0000' : crypto.randomInt(1000, 10000).toString();
    const codeHash = await bcrypt.hash(rawCode, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let channel: OtpChannel;
    if (devMode) {
      this.logger.warn(
        `[OTP_DEV_MODE] code=0000 skipping notification phone=${phone}`,
      );
      channel = OtpChannel.SMS;
    } else {
      channel = await this.notif.sendOtp(phone, rawCode);
    }

    await this.otpRepo.create({
      phoneNumberId: phoneRecord.id,
      code: codeHash,
      purpose,
      channel,
      metadata: {
        source: 'send_otp',
        purpose,
        app: app ?? null,
        deviceInfo: cmd.deviceInfo ?? null,
        ipAddress: cmd.ipAddress ?? null,
      },
      expiresAt,
    });

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
      await this.checkCooldown(cooldownKey);
      await this.checkAttempts(attemptsKey);
    } catch (error) {
      if (this.isTooManyRequestsError(error)) throw error;
      this.logger.warn(
        'Redis indisponible, OTP envoyé sans contrôle anti-spam.',
      );
    }
  }

  private async checkCooldown(cooldownKey: string): Promise<void> {
    const hasCooldown = await this.redisService.exists(cooldownKey);
    if (hasCooldown) {
      const ttl = Math.max(await this.redisService.ttl(cooldownKey), 1);
      throw new HttpException(
        `Patientez ${ttl}s avant de redemander un code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async checkAttempts(attemptsKey: string): Promise<void> {
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
        `Impossible d'écrire le cooldown OTP Redis: ${(error as Error).message}`,
      );
    }
  }
}

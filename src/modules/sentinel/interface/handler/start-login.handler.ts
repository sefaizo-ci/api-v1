import { Inject, Logger } from '@nestjs/common';
import {
  BadRequestException,
  UnauthorizedException,
} from '../../../../libs/exceptions/domain.exceptions';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  OtpChannel,
  OtpPurpose,
  type LoginApp,
} from '../../core/enums/auth.enums';
import type { INotificationService } from '../../core/services/notification.service.interface';
import type { IOtpRepository } from '../../core/services/otp.service.interface';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { TokenService } from '../../services/token.service';
import { StartLoginCommand } from '../commands/start-login.command';

type StartLoginResult = {
  challengeToken: string;
  scope: 'challenge-only';
  channel: OtpChannel;
  expiresIn: number;
};

@CommandHandler(StartLoginCommand)
export class StartLoginHandler implements ICommandHandler<StartLoginCommand> {
  private readonly logger = new Logger(StartLoginHandler.name);

  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IOtpRepository') private readonly otpRepo: IOtpRepository,
    @Inject('INotificationService')
    private readonly notif: INotificationService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
  ) {}

  private isDevModeEnabled(): boolean {
    return (this.config.get<string>('OTP_DEV_MODE') ?? 'false') === 'true';
  }

  async execute(cmd: StartLoginCommand): Promise<StartLoginResult> {
    const loginApp: LoginApp = cmd.app;

    const user = await this.userRepo.findByPhone(cmd.phone, loginApp);
    if (!user || !user.isAccountActive()) {
      throw new BadRequestException(`Aucun compte ${loginApp} pour ce numéro.`);
    }
    if (!user.hasPin()) throw new UnauthorizedException('PIN non configuré.');
    if (user.isPinBlocked())
      throw new UnauthorizedException('PIN bloqué 1 heure.');

    const pinValid = await bcrypt.compare(
      cmd.pin,
      user.clientSecret!.secretHash,
    );
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
    await this.userRepo.logAuthEvent({
      event: 'LOGIN_OTP_REQUESTED',
      userId: user.id,
      deviceInfo: cmd.deviceInfo,
      ipAddress: cmd.ipAddress,
      metadata: { app: loginApp },
    });

    await this.otpRepo.invalidatePrevious(
      user.phoneId,
      OtpPurpose.LOGIN,
      loginApp,
    );

    const devMode = this.isDevModeEnabled();
    const rawCode = devMode ? '0000' : crypto.randomInt(1000, 10000).toString();
    const codeHash = await bcrypt.hash(rawCode, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let channel: OtpChannel;
    if (devMode) {
      this.logger.warn(
        `[OTP_DEV_MODE] code=0000 skipping notification phone=${cmd.phone}`,
      );
      channel = OtpChannel.SMS;
    } else {
      channel = await this.notif.sendOtp(cmd.phone, rawCode);
    }

    await this.otpRepo.create({
      phoneNumberId: user.phoneId,
      userId: user.id,
      code: codeHash,
      purpose: OtpPurpose.LOGIN,
      channel,
      metadata: {
        source: 'start_login',
        app: loginApp,
        deviceInfo: cmd.deviceInfo ?? null,
      },
      expiresAt,
    });

    const challengeToken = this.tokenService.generateChallengeToken({
      phoneId: user.phoneId,
      phone: user.phone,
      purpose: OtpPurpose.LOGIN,
      app: loginApp,
      userId: user.id,
    });

    return { challengeToken, scope: 'challenge-only', channel, expiresIn: 600 };
  }
}

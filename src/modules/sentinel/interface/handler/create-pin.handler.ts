import { Inject } from '@nestjs/common';
import { BadRequestException } from '../../../../libs/exceptions/domain.exceptions';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import type { IRefreshTokenRepository } from '../../core/services/refresh-token.service.interface';
import type {
  IUserRepository,
  OnboardingMeta,
} from '../../core/services/user.service.interface';
import { TokenService } from '../../services/token.service';
import { CreatePinCommand } from '../commands/create-pin.command';

const WEAK_PINS = [
  '0000',
  '1234',
  '4321',
  '1111',
  '2222',
  '3333',
  '4444',
  '5555',
  '6666',
  '7777',
  '8888',
  '9999',
  '1212',
  '2580',
];

type CreatePinResult = {
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

@CommandHandler(CreatePinCommand)
export class CreatePinHandler implements ICommandHandler<CreatePinCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IRefreshTokenRepository')
    private readonly refreshRepo: IRefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(cmd: CreatePinCommand): Promise<CreatePinResult> {
    if (cmd.pin !== cmd.confirmPin) {
      throw new BadRequestException('Les deux PIN ne correspondent pas.');
    }
    if (!/^\d{4}$/.test(cmd.pin)) {
      throw new BadRequestException(
        'Le PIN doit contenir exactement 4 chiffres.',
      );
    }
    if (WEAK_PINS.includes(cmd.pin)) {
      throw new BadRequestException(
        'PIN non autorisé. Choisissez un code différent.',
      );
    }
    if (/^(\d)\1+$/.test(cmd.pin)) {
      throw new BadRequestException(
        'PIN trop simple. Évitez les chiffres identiques (ex: 1111).',
      );
    }

    const pinHash = await bcrypt.hash(cmd.pin, 12);

    const created = await this.userRepo.createAndLinkUser({
      phoneId: cmd.phoneId,
      app: cmd.app,
      firstName: '',
      lastName: '',
      pinHash,
    });
    const user = created.user;
    const professionalId = created.professionalId;

    await this.userRepo.acceptTerms(user.id);

    await this.userRepo.logAuthEvent({
      event: 'REGISTRATION_COMPLETED',
      userId: user.id,
      metadata: { app: cmd.app },
    });

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      phone: user.phone,
      role: cmd.app,
    });
    const { raw, hash } = this.tokenService.generateRefreshToken();

    await this.refreshRepo.create({
      userId: user.id,
      tokenHash: hash,
      deviceInfo: cmd.deviceInfo,
      platform: 'UNKNOWN',
      metadata: { source: 'registration_completed', app: cmd.app },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const onboarding = await this.userRepo.getOnboardingMeta(user.id, cmd.app);

    return {
      accessToken,
      refreshToken: raw,
      professionalId,
      clientId: cmd.app === 'CLIENT' ? user.id : null,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        app: cmd.app,
        hasAcceptedTerms: true,
        acceptedTermsAt: new Date().toISOString(),
        onboarding,
      },
    };
  }
}

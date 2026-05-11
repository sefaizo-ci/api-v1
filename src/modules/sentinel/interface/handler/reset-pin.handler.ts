import { BadRequestException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { ResetPinCommand } from '../commands/reset-pin.command';
import { withAuthFlowMetadata } from '../utils/auth-metadata.util';

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

@CommandHandler(ResetPinCommand)
export class ResetPinHandler implements ICommandHandler<ResetPinCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async execute(cmd: ResetPinCommand): Promise<{ message: string }> {
    if (cmd.pin !== cmd.confirmPin) {
      throw new BadRequestException('Les deux PIN ne correspondent pas.');
    }
    if (!/^\d{4}$/.test(cmd.pin)) {
      throw new BadRequestException(
        'Le PIN doit contenir exactement 4 chiffres.',
      );
    }
    if (WEAK_PINS.includes(cmd.pin) || /^(\d)\1+$/.test(cmd.pin)) {
      throw new BadRequestException(
        'PIN trop simple. Choisissez un code plus sécurisé.',
      );
    }

    const user = await this.userRepo.findById(cmd.userId);
    if (!user || !user.isAccountActive()) {
      throw new BadRequestException('Utilisateur introuvable.');
    }
    if (!user.isVerified) {
      throw new BadRequestException('Numéro non vérifié.');
    }

    const pinHash = await bcrypt.hash(cmd.pin, 12);
    await this.userRepo.updatePin(cmd.userId, pinHash);

    await this.userRepo.updateMetadata(
      cmd.userId,
      withAuthFlowMetadata(user.metadata, {
        status: 'ACTIVE',
        currentStep: 'PIN_RESET_COMPLETED',
      }),
    );

    await this.userRepo.logAuthEvent({
      event: 'PIN_RESET_COMPLETED',
      userId: cmd.userId,
      ipAddress: cmd.ipAddress,
    });

    return { message: 'PIN réinitialisé avec succès.' };
  }
}

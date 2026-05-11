import {
  BadRequestException,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { ChangePinCommand } from '../commands/change-pin.command';

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

@CommandHandler(ChangePinCommand)
export class ChangePinHandler implements ICommandHandler<ChangePinCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async execute(cmd: ChangePinCommand): Promise<{ message: string }> {
    if (cmd.newPin !== cmd.confirmNewPin) {
      throw new BadRequestException(
        'Les deux nouveaux PIN ne correspondent pas.',
      );
    }
    if (!/^\d{4}$/.test(cmd.newPin)) {
      throw new BadRequestException(
        'Le PIN doit contenir exactement 4 chiffres.',
      );
    }
    if (WEAK_PINS.includes(cmd.newPin) || /^(\d)\1+$/.test(cmd.newPin)) {
      throw new BadRequestException(
        'PIN trop simple. Choisissez un code plus sécurisé.',
      );
    }
    if (cmd.currentPin === cmd.newPin) {
      throw new BadRequestException(
        "Le nouveau PIN doit être différent de l'actuel.",
      );
    }

    const user = await this.userRepo.findById(cmd.userId);
    if (!user || !user.isAccountActive()) {
      throw new UnauthorizedException('Session invalide.');
    }
    if (!user.hasPin()) {
      throw new BadRequestException('Aucun PIN configuré.');
    }
    if (user.isPinBlocked()) {
      throw new UnauthorizedException('PIN bloqué 1 heure.');
    }

    const pinValid = await bcrypt.compare(
      cmd.currentPin,
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
        `PIN actuel incorrect. ${user.pinRemainingAttempts() - 1} tentative(s) restante(s).`,
      );
    }

    await this.userRepo.resetPinFail(user.id);
    const newHash = await bcrypt.hash(cmd.newPin, 12);
    await this.userRepo.updatePin(cmd.userId, newHash);

    await this.userRepo.logAuthEvent({
      event: 'PIN_CHANGED',
      userId: cmd.userId,
    });

    return { message: 'PIN modifié avec succès.' };
  }
}

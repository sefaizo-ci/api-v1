import { BadRequestException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { CreatePinCommand } from '../commands/create-pin.command';
import { withAuthFlowMetadata } from '../utils/auth-metadata.util';

const WEAK_PINS = [
  '123456',
  '654321',
  '123123',
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
];

@CommandHandler(CreatePinCommand)
export class CreatePinHandler implements ICommandHandler<CreatePinCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async execute(cmd: CreatePinCommand): Promise<void> {
    if (cmd.pin !== cmd.confirmPin) {
      throw new BadRequestException('Les deux PIN ne correspondent pas.');
    }
    if (!/^\d{4,6}$/.test(cmd.pin)) {
      throw new BadRequestException(
        'Le PIN doit contenir entre 4 et 6 chiffres.',
      );
    }
    if (WEAK_PINS.includes(cmd.pin) || /^(\d)\1+$/.test(cmd.pin)) {
      throw new BadRequestException(
        'PIN trop simple. Choisissez un code plus sécurisé.',
      );
    }

    const user = await this.userRepo.findById(cmd.userId);
    if (!user || user.deletedAt !== null) {
      throw new BadRequestException('Utilisateur introuvable.');
    }

    const pinHash = await bcrypt.hash(cmd.pin, 12);
    await this.userRepo.updatePin(cmd.userId, pinHash);

    const updateData: {
      firstName?: string;
      lastName?: string;
      metadata?: any;
    } = {
      firstName: cmd.firstName,
      lastName: cmd.lastName,
      metadata: {
        profileCompleted: true,
        profileCompletedAt: new Date().toISOString(),
      },
    };

    await this.userRepo.update(cmd.userId, updateData);

    await this.userRepo.assignRole(cmd.userId, cmd.role);

    await this.userRepo.updateMetadata(
      cmd.userId,
      withAuthFlowMetadata(user.metadata, {
        status: 'ACTIVE',
        currentStep: 'REGISTRATION_COMPLETED',
        registrationCompleted: true,
        registrationCompletedAt: new Date().toISOString(),
      }),
    );

    await this.userRepo.logAuthEvent({
      event: 'REGISTRATION_COMPLETED',
      userId: cmd.userId,
      metadata: { role: cmd.role },
    });
  }
}

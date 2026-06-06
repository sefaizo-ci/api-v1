import { BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { SkipOnboardingStepCommand } from '../commands/skip-onboarding-step.command';

const DEFERRABLE_STEPS = ['categorie', 'localisation', 'service', 'galerie'];

@CommandHandler(SkipOnboardingStepCommand)
export class SkipOnboardingStepHandler implements ICommandHandler<SkipOnboardingStepCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async execute(cmd: SkipOnboardingStepCommand): Promise<{ skipped: string }> {
    if (cmd.role !== 'PROFESSIONAL') {
      throw new ForbiddenException("L'onboarding professionnel ne s'applique pas à ce compte.");
    }

    if (!DEFERRABLE_STEPS.includes(cmd.step)) {
      throw new BadRequestException(
        `L'étape "${cmd.step}" ne peut pas être passée.`,
      );
    }

    await this.userRepo.skipOnboardingStep(cmd.userId, cmd.step);
    return { skipped: cmd.step };
  }
}

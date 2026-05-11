import { BadRequestException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { CompleteOnboardingCommand } from '../commands/complete-onboarding.command';

type CompleteOnboardingResult = {
  onboardingCompletedAt: string;
};

@CommandHandler(CompleteOnboardingCommand)
export class CompleteOnboardingHandler implements ICommandHandler<CompleteOnboardingCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async execute(
    cmd: CompleteOnboardingCommand,
  ): Promise<CompleteOnboardingResult> {
    const user = await this.userRepo.findById(cmd.userId);

    if (user?.onboardingCompletedAt) {
      return {
        onboardingCompletedAt: user.onboardingCompletedAt.toISOString(),
      };
    }

    const step: string = await this.userRepo.getOnboardingStep(cmd.userId);
    if (step !== 'COMPLETED') {
      throw new BadRequestException(
        `Onboarding incomplet — étape manquante : ${step}.`,
      );
    }

    await this.userRepo.completeOnboarding(cmd.userId);
    return { onboardingCompletedAt: new Date().toISOString() };
  }
}

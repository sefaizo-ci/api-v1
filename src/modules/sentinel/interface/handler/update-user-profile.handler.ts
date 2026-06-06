import { Inject } from '@nestjs/common';
import { BadRequestException } from '../../../../libs/exceptions/domain.exceptions';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type {
  IUserRepository,
  OnboardingMeta,
} from '../../core/services/user.service.interface';
import { ProfessionalEligibilityService } from '../../services/professional-eligibility.service';
import { UpdateUserProfileCommand } from '../commands/update-user-profile.command';

type UpdateUserProfileResult = {
  id: string;
  firstName: string;
  lastName: string;
  onboarding: OnboardingMeta;
};

@CommandHandler(UpdateUserProfileCommand)
export class UpdateUserProfileHandler implements ICommandHandler<UpdateUserProfileCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    private readonly eligibility: ProfessionalEligibilityService,
  ) {}

  async execute(
    cmd: UpdateUserProfileCommand,
  ): Promise<UpdateUserProfileResult> {
    if (!cmd.firstName && !cmd.lastName) {
      throw new BadRequestException('Au moins un champ doit être fourni.');
    }

    const user = await this.userRepo.update(cmd.userId, {
      firstName: cmd.firstName,
      lastName: cmd.lastName,
    });

    if (cmd.role === 'PROFESSIONAL') {
      await this.eligibility.refresh(cmd.userId);
    }

    const onboarding = await this.userRepo.getOnboardingMeta(
      cmd.userId,
      cmd.role,
    );

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      onboarding,
    };
  }
}

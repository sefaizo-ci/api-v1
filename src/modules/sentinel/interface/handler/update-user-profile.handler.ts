import { BadRequestException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { UpdateUserProfileCommand } from '../commands/update-user-profile.command';

type UpdateUserProfileResult = {
  id: string;
  firstName: string;
  lastName: string;
  onboardingStep: string;
};

@CommandHandler(UpdateUserProfileCommand)
export class UpdateUserProfileHandler implements ICommandHandler<UpdateUserProfileCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
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

    const onboardingStep: string = await this.userRepo.getOnboardingStep(
      cmd.userId,
    );

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      onboardingStep,
    };
  }
}

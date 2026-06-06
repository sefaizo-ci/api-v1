import { ICommand } from '@nestjs/cqrs';

export class SkipOnboardingStepCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly step: string,
    public readonly role: string,
  ) {}
}

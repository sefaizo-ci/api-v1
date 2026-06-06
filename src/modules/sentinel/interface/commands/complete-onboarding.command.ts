export class CompleteOnboardingCommand {
  constructor(
    public readonly userId: string,
    public readonly role: string,
  ) {}
}

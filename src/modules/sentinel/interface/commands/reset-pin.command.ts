export class ResetPinCommand {
  constructor(
    public readonly userId: string,
    public readonly pin: string,
    public readonly confirmPin: string,
    public readonly ipAddress?: string,
  ) {}
}

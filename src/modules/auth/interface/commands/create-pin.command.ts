export class CreatePinCommand {
  constructor(
    public readonly userId: string,
    public readonly pin: string,
    public readonly confirmPin: string,
    public readonly firstName: string,
    public readonly lastName: string,
  ) {}
}

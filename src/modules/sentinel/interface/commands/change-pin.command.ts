export class ChangePinCommand {
  constructor(
    public readonly userId: string,
    public readonly currentPin: string,
    public readonly newPin: string,
    public readonly confirmNewPin: string,
  ) {}
}

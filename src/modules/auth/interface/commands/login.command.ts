export class LoginCommand {
  constructor(
    public readonly userId: string,
    public readonly pin: string,
    public readonly deviceInfo?: string,
    public readonly ipAddress?: string,
    public readonly platform?: string,
  ) {}
}

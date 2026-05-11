export class RegisterPushTokenCommand {
  constructor(
    public readonly userId: string,
    public readonly platform: string,
    public readonly deviceId: string,
    public readonly pushToken: string,
  ) {}
}

export class StartLoginCommand {
  constructor(
    public readonly phone: string,
    public readonly pin: string,
    public readonly deviceInfo?: string,
  ) {}
}

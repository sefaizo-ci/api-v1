import type { LoginApp } from '../../core/enums/auth.enums';

export class CreatePinCommand {
  constructor(
    public readonly phoneId: string,
    public readonly app: LoginApp,
    public readonly pin: string,
    public readonly confirmPin: string,
    public readonly deviceInfo?: string,
  ) {}
}

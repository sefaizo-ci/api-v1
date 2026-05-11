import type { LoginApp } from '../../core/enums/auth.enums';

export class LoginCompleteCommand {
  constructor(
    public readonly userId: string,
    public readonly phoneId: string,
    public readonly phone: string,
    public readonly app: LoginApp,
    public readonly code: string,
    public readonly deviceInfo?: string,
    public readonly deviceId?: string,
    public readonly ipAddress?: string,
  ) {}
}

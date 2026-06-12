import type { LoginApp } from '../../core/enums/auth.enums';

export class LogoutCommand {
  constructor(
    public readonly userId: string,
    public readonly refreshToken?: string,
    public readonly allDevices?: boolean,
    public readonly app?: LoginApp,
  ) {}
}

import type { LoginApp, OtpSendPurpose } from '../../core/enums/auth.enums';

export class SendOtpCommand {
  constructor(
    public readonly phone: string,
    public readonly purpose: OtpSendPurpose,
    public readonly app: LoginApp,
    public readonly deviceInfo?: string,
    public readonly ipAddress?: string,
  ) {}
}

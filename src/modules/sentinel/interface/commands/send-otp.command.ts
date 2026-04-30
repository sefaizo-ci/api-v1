import type { OtpSendPurpose } from '../../core/enums/auth.enums';

export class SendOtpCommand {
  constructor(
    public readonly phone: string,
    public readonly purpose: OtpSendPurpose,
    public readonly deviceInfo?: string,
  ) {}
}

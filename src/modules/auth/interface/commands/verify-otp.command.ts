import type { PublicOtpPurpose } from '../../core/enums/auth.enums';

export class VerifyOtpCommand {
  constructor(
    public readonly phone: string,
    public readonly code: string,
    public readonly purpose: PublicOtpPurpose,
  ) {}
}

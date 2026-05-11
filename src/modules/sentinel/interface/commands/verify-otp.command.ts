import { Role } from '@prisma/client';
import type { LoginApp, OtpSendPurpose } from '../../core/enums/auth.enums';

export class VerifyOtpCommand {
  constructor(
    public readonly phone: string,
    public readonly code: string,
    public readonly purpose: OtpSendPurpose,
    public readonly app: LoginApp = Role.CLIENT,
  ) {}
}

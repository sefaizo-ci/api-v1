import { Role } from '@prisma/client';
import type { LoginApp, PublicOtpPurpose } from '../../core/enums/auth.enums';

export class VerifyOtpCommand {
  constructor(
    public readonly phone: string,
    public readonly code: string,
    public readonly purpose: PublicOtpPurpose,
    public readonly app: LoginApp = Role.CLIENT,
  ) {}
}

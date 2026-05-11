import { Role } from '@prisma/client';
import type { LoginApp } from '../../core/enums/auth.enums';

export class StartLoginCommand {
  constructor(
    public readonly phone: string,
    public readonly pin: string,
    public readonly deviceInfo?: string,
    public readonly app: LoginApp = Role.CLIENT,
    public readonly ipAddress?: string,
  ) {}
}

import type { Prisma } from '@prisma/client';
import type { UserRole } from '../enums/auth.enums';

export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly phone: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly role: UserRole,
    public readonly metadata: Prisma.JsonValue,
    public readonly isVerified: boolean,
    public readonly isActive: boolean,
    public readonly pinHash: string | null,
    public readonly pinFailCount: number,
    public readonly pinBlockedUntil: Date | null,
    public readonly createdAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  isPinBlocked(): boolean {
    if (!this.pinBlockedUntil) return false;
    return this.pinBlockedUntil > new Date();
  }

  hasPin(): boolean {
    return this.pinHash !== null;
  }

  isAccountActive(): boolean {
    return this.isActive && this.deletedAt === null;
  }

  pinRemainingAttempts(): number {
    return Math.max(0, 5 - this.pinFailCount);
  }
}

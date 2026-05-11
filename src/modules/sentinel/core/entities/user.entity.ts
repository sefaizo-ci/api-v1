import type { Prisma } from '@prisma/client';
import type { UserRole } from '../enums/auth.enums';

export type ClientSecretData = {
  id: string;
  secretHash: string;
  failCount: number;
  blockedUntil: Date | null;
};

export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly phoneId: string,
    public readonly phone: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly role: UserRole,
    public readonly metadata: Prisma.JsonValue,
    public readonly isVerified: boolean,
    public readonly isActive: boolean,
    public readonly clientSecret: ClientSecretData | null,
    public readonly createdAt: Date,
    public readonly deletedAt: Date | null,
    public readonly acceptedTermsAt: Date | null,
    public readonly onboardingCompletedAt: Date | null,
  ) {}

  isPinBlocked(): boolean {
    if (!this.clientSecret?.blockedUntil) return false;
    return this.clientSecret.blockedUntil > new Date();
  }

  hasPin(): boolean {
    return this.clientSecret !== null && Boolean(this.clientSecret.secretHash);
  }

  isAccountActive(): boolean {
    return this.isActive && this.deletedAt === null;
  }

  pinRemainingAttempts(): number {
    return Math.max(0, 5 - (this.clientSecret?.failCount ?? 0));
  }
}

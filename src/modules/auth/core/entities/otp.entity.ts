import type { Prisma } from '@prisma/client';
import type { OtpChannel, OtpPurpose } from '../enums/auth.enums';

export class OtpEntity {
  private static readonly MAX_ATTEMPTS = 5;

  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly code: string,
    public readonly purpose: OtpPurpose,
    public readonly channel: OtpChannel,
    public readonly metadata: Prisma.JsonValue,
    public readonly isUsed: boolean,
    public readonly failCount: number,
    public readonly blockedUntil: Date | null,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
  ) {}

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isBlocked(): boolean {
    if (!this.blockedUntil) return false;
    return this.blockedUntil > new Date();
  }

  isValid(): boolean {
    return !this.isUsed && !this.isExpired() && !this.isBlocked();
  }

  hasReachedMaxAttempts(): boolean {
    return this.failCount >= OtpEntity.MAX_ATTEMPTS;
  }

  remainingAttempts(): number {
    return Math.max(0, OtpEntity.MAX_ATTEMPTS - this.failCount);
  }
}

import type { Prisma } from '@prisma/client';

export class RefreshTokenEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenHash: string,
    public readonly deviceInfo: string | null,
    public readonly ipAddress: string | null,
    public readonly platform: string | null,
    public readonly metadata: Prisma.JsonValue,
    public readonly isRevoked: boolean,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
    public readonly lastUsedAt: Date,
  ) {}

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isValid(): boolean {
    return !this.isRevoked && !this.isExpired();
  }
}

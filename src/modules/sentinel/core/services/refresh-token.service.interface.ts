import type { Prisma } from '@prisma/client';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';

export interface IRefreshTokenRepository {
  create(data: {
    userId: string;
    tokenHash: string;
    deviceInfo?: string;
    ipAddress?: string;
    platform?: string;
    metadata?: Prisma.InputJsonValue;
    expiresAt: Date;
  }): Promise<{ id: string }>;
  findByHash(tokenHash: string): Promise<RefreshTokenEntity | null>;
  findById(id: string): Promise<RefreshTokenEntity | null>;
  findAllActiveForUser(userId: string): Promise<RefreshTokenEntity[]>;
  revoke(tokenId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  updateLastUsed(tokenId: string): Promise<void>;
}

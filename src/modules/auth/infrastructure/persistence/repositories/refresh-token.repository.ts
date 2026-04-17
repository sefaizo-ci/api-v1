import { Injectable } from '@nestjs/common';

import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { RefreshTokenEntity } from '../../../core/entities/refresh-token.entity';
import { IRefreshTokenRepository } from '../../../core/services/refresh-token.service.interface';
import { RefreshTokenMapper } from '../../mappers/refresh-token.mapper';

@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    userId: string;
    tokenHash: string;
    deviceInfo?: string;
    ipAddress?: string;
    platform?: string;
    metadata?: Prisma.InputJsonValue;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({ data });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    const raw = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    return raw ? RefreshTokenMapper.toDomain(raw) : null;
  }

  async revoke(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { isRevoked: true },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async updateLastUsed(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { lastUsedAt: new Date() },
    });
  }
}

import { Injectable } from '@nestjs/common';

import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../libs/database/prisma.service';
import { RefreshTokenEntity } from '../../../core/entities/refresh-token.entity';
import { IRefreshTokenRepository } from '../../../core/services/refresh-token.service.interface';
import { RefreshTokenMapper } from '../../mappers/refresh-token.mapper';

@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    tokenHash: string;
    deviceInfo?: string;
    ipAddress?: string;
    platform?: string;
    metadata?: Prisma.InputJsonValue;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    const token = await this.prisma.refreshToken.create({ data });
    return { id: token.id };
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    const raw = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    return raw ? RefreshTokenMapper.toDomain(raw) : null;
  }

  async findById(id: string): Promise<RefreshTokenEntity | null> {
    const raw = await this.prisma.refreshToken.findUnique({ where: { id } });
    return raw ? RefreshTokenMapper.toDomain(raw) : null;
  }

  async findAllActiveForUser(userId: string): Promise<RefreshTokenEntity[]> {
    const rows = await this.prisma.refreshToken.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    return rows.map((row) => RefreshTokenMapper.toDomain(row));
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

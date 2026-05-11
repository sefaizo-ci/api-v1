import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { IRefreshTokenRepository } from '../../core/services/refresh-token.service.interface';
import { GetSessionsQuery } from './get-sessions.query';

@QueryHandler(GetSessionsQuery)
export class GetSessionsHandler implements IQueryHandler<GetSessionsQuery> {
  constructor(
    @Inject('IRefreshTokenRepository')
    private readonly refreshRepo: IRefreshTokenRepository,
  ) {}

  async execute(query: GetSessionsQuery) {
    const tokens = await this.refreshRepo.findAllActiveForUser(query.userId);
    return tokens.map((t) => ({
      id: t.id,
      platform: t.platform,
      deviceInfo: t.deviceInfo,
      ipAddress: t.ipAddress,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
      expiresAt: t.expiresAt,
    }));
  }
}

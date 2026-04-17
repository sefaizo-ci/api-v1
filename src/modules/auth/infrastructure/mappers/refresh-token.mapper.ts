import { RefreshTokenEntity } from '../../core/entities/refresh-token.entity';
import { RefreshTokenPrismaEntity } from '../persistence/entities/refresh-token.prisma-entity';

export class RefreshTokenMapper {
  static toDomain(raw: RefreshTokenPrismaEntity): RefreshTokenEntity {
    return new RefreshTokenEntity(
      raw.id,
      raw.userId,
      raw.tokenHash,
      raw.deviceInfo,
      raw.ipAddress,
      raw.platform,
      raw.metadata,
      raw.isRevoked,
      raw.expiresAt,
      raw.createdAt,
      raw.lastUsedAt,
    );
  }
}

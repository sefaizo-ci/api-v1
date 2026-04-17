import { UserEntity } from '../../core/entities/user.entity';
import { UserPrismaEntity } from '../persistence/entities/user.prisma-entity';

export class UserMapper {
  static toDomain(raw: UserPrismaEntity): UserEntity {
    return new UserEntity(
      raw.id,
      raw.phone,
      raw.firstName,
      raw.lastName,
      raw.role,
      raw.metadata,
      raw.isVerified,
      raw.isActive,
      raw.pinHash,
      raw.pinFailCount,
      raw.pinBlockedUntil,
      raw.createdAt,
      raw.deletedAt,
    );
  }
}

import { UserEntity } from '../../core/entities/user.entity';
import { UserPrismaEntity } from '../persistence/entities/user.prisma-entity';

export class UserMapper {
  static toDomain(raw: UserPrismaEntity): UserEntity {
    return new UserEntity(
      raw.id,
      raw.phoneId,
      raw.phone.number,
      raw.firstName,
      raw.lastName,
      raw.role,
      raw.metadata,
      raw.isVerified,
      raw.isActive,
      raw.clientSecret
        ? {
            id: raw.clientSecret.id,
            secretHash: raw.clientSecret.secretHash,
            failCount: raw.clientSecret.failCount,
            blockedUntil: raw.clientSecret.blockedUntil,
          }
        : null,
      raw.createdAt,
      raw.deletedAt,
      raw.acceptedTermsAt,
      raw.onboardingCompletedAt,
    );
  }
}

import { OtpEntity } from '../../core/entities/otp.entity';
import { OtpPrismaEntity } from '../persistence/entities/otp.prisma-entity';

export class OtpMapper {
  static toDomain(raw: OtpPrismaEntity): OtpEntity {
    return new OtpEntity(
      raw.id,
      raw.phoneNumberId,
      raw.userId ?? null,
      raw.code,
      raw.purpose,
      raw.channel,
      raw.metadata,
      raw.isUsed,
      raw.failCount,
      raw.blockedUntil,
      raw.expiresAt,
      raw.createdAt,
    );
  }
}

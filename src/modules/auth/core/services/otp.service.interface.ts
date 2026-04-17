import type { Prisma } from '@prisma/client';
import { OtpEntity } from '../entities/otp.entity';
import { OtpChannel, OtpPurpose } from '../enums/auth.enums';

export { OtpChannel, OtpPurpose };

export interface IOtpRepository {
  create(data: {
    userId: string;
    code: string;
    purpose: OtpPurpose;
    channel: OtpChannel;
    metadata?: Prisma.InputJsonValue;
    expiresAt: Date;
  }): Promise<OtpEntity>;
  findLatestValid(
    userId: string,
    purpose: OtpPurpose,
  ): Promise<OtpEntity | null>;
  markUsed(otpId: string): Promise<void>;
  incrementFail(otpId: string): Promise<void>;
  blockOtp(otpId: string, until: Date): Promise<void>;
  invalidatePrevious(userId: string, purpose: OtpPurpose): Promise<void>;
}

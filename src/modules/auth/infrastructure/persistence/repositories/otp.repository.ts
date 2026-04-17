import { Injectable } from '@nestjs/common';

import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { OtpEntity } from '../../../core/entities/otp.entity';
import {
  IOtpRepository,
  OtpChannel,
  OtpPurpose,
} from '../../../core/services/otp.service.interface';
import { OtpMapper } from '../../mappers/otp.mapper';

@Injectable()
export class OtpRepository implements IOtpRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    userId: string;
    code: string;
    purpose: OtpPurpose;
    channel: OtpChannel;
    metadata?: Prisma.InputJsonValue;
    expiresAt: Date;
  }): Promise<OtpEntity> {
    const raw = await this.prisma.otpCode.create({ data });
    return OtpMapper.toDomain(raw);
  }

  async findLatestValid(
    userId: string,
    purpose: OtpPurpose,
  ): Promise<OtpEntity | null> {
    const raw = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, isUsed: false, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return raw ? OtpMapper.toDomain(raw) : null;
  }

  async markUsed(otpId: string): Promise<void> {
    await this.prisma.otpCode.update({
      where: { id: otpId },
      data: { isUsed: true },
    });
  }

  async incrementFail(otpId: string): Promise<void> {
    await this.prisma.otpCode.update({
      where: { id: otpId },
      data: { failCount: { increment: 1 } },
    });
  }

  async blockOtp(otpId: string, until: Date): Promise<void> {
    await this.prisma.otpCode.update({
      where: { id: otpId },
      data: { blockedUntil: until },
    });
  }

  async invalidatePrevious(userId: string, purpose: OtpPurpose): Promise<void> {
    await this.prisma.otpCode.updateMany({
      where: { userId, purpose, isUsed: false, deletedAt: null },
      data: { isUsed: true },
    });
  }
}

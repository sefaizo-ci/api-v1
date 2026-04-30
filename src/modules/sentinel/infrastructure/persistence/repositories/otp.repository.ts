import { Injectable } from '@nestjs/common';

import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../libs/database/prisma.service';
import { OtpEntity } from '../../../core/entities/otp.entity';
import type { LoginApp } from '../../../core/enums/auth.enums';
import {
  IOtpRepository,
  OtpChannel,
  OtpPurpose,
} from '../../../core/services/otp.service.interface';
import { OtpMapper } from '../../mappers/otp.mapper';

@Injectable()
export class OtpRepository implements IOtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    code: string;
    purpose: OtpPurpose;
    channel: OtpChannel;
    metadata?: Prisma.InputJsonValue;
    expiresAt: Date;
  }): Promise<OtpEntity> {
    const raw = await this.prisma.challenge.create({ data });
    return OtpMapper.toDomain(raw);
  }

  async findLatestValid(
    userId: string,
    purpose: OtpPurpose,
    app?: LoginApp,
  ): Promise<OtpEntity | null> {
    const raw = await this.prisma.challenge.findFirst({
      where: {
        userId,
        purpose,
        isUsed: false,
        deletedAt: null,
        ...(app ? { metadata: { path: ['app'], equals: app } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return raw ? OtpMapper.toDomain(raw) : null;
  }

  async markUsed(otpId: string): Promise<void> {
    await this.prisma.challenge.update({
      where: { id: otpId },
      data: { isUsed: true },
    });
  }

  async incrementFail(otpId: string): Promise<void> {
    await this.prisma.challenge.update({
      where: { id: otpId },
      data: { failCount: { increment: 1 } },
    });
  }

  async blockOtp(otpId: string, until: Date): Promise<void> {
    await this.prisma.challenge.update({
      where: { id: otpId },
      data: { blockedUntil: until },
    });
  }

  async invalidatePrevious(
    userId: string,
    purpose: OtpPurpose,
    reason?: string,
    app?: LoginApp,
  ): Promise<void> {
    await this.prisma.challenge.updateMany({
      where: {
        userId,
        purpose,
        isUsed: false,
        deletedAt: null,
        ...(app ? { metadata: { path: ['app'], equals: app } } : {}),
      },
      data: {
        isUsed: true,
        metadata: {
          reason: !reason ? 'unknown' : reason,
        },
      },
    });
  }
}

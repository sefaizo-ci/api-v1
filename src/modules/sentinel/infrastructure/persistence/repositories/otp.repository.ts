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
    phoneNumberId: string;
    userId?: string;
    code: string;
    purpose: OtpPurpose;
    channel: OtpChannel;
    metadata?: Prisma.InputJsonValue;
    expiresAt: Date;
  }): Promise<OtpEntity> {
    const raw = await this.prisma.challenge.create({
      data: {
        phoneNumberId: data.phoneNumberId,
        userId: data.userId,
        code: data.code,
        purpose: data.purpose,
        channel: data.channel,
        metadata: data.metadata,
        expiresAt: data.expiresAt,
      },
    });
    return OtpMapper.toDomain(raw);
  }

  async findLatestValid(
    phoneNumberId: string,
    purpose: OtpPurpose,
    app?: LoginApp,
  ): Promise<OtpEntity | null> {
    const raw = await this.prisma.challenge.findFirst({
      where: {
        phoneNumberId,
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
    phoneNumberId: string,
    purpose: OtpPurpose,
    app?: LoginApp,
  ): Promise<void> {
    await this.prisma.challenge.updateMany({
      where: {
        phoneNumberId,
        purpose,
        isUsed: false,
        deletedAt: null,
        ...(app ? { metadata: { path: ['app'], equals: app } } : {}),
      },
      data: { isUsed: true },
    });
  }
}

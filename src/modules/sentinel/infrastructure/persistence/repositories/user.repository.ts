import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../libs/database/prisma.service';

import { UserEntity } from '../../../core/entities/user.entity';
import { UserRole } from '../../../core/enums/auth.enums';
import { IUserRepository } from '../../../core/services/user.service.interface';
import { UserMapper } from '../../mappers/user.mapper';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getRolesByUserId(userId: string): Promise<UserRole[]> {
    const roleRows = await this.prisma.phoneRole.findMany({
      where: { userId },
      select: { role: true },
    });

    if (roleRows.length > 0) {
      return [...new Set(roleRows.map((row) => row.role))];
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return user ? [user.role] : [];
  }

  async assignRole(userId: string, role: UserRole): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      select: { id: true, phoneId: true, isVerified: true },
    });

    if (!user) return;

    await this.prisma.phoneNumber.update({
      where: { id: user.phoneId },
      data: { isVerified: user.isVerified, deletedAt: null },
    });

    await this.prisma.phoneRole.upsert({
      where: { phoneId_role: { phoneId: user.phoneId, role } },
      update: { userId },
      create: { phoneId: user.phoneId, userId, role },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async hasProfessionalProfile(userId: string): Promise<boolean> {
    const profile = await this.prisma.professional.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });

    return Boolean(profile);
  }

  async findByPhone(phone: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        phone: { number: phone, deletedAt: null },
      },
      include: { phone: true, clientSecret: true },
    });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, isActive: true },
      include: { phone: true, clientSecret: true },
    });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async create(data: {
    phone: string;
    firstName: string;
    lastName: string;
    role?: Extract<UserRole, 'CLIENT' | 'PROFESSIONAL'>;
    metadata?: Prisma.InputJsonValue;
  }): Promise<UserEntity> {
    const raw = await this.prisma.$transaction(async (tx) => {
      const createdPhone = await tx.phoneNumber.upsert({
        where: { number: data.phone },
        update: { deletedAt: null },
        create: { number: data.phone },
        select: { id: true },
      });

      const createdUser = await tx.user.create({
        data: {
          phoneId: createdPhone.id,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role ?? UserRole.CLIENT,
          metadata: data.metadata,
        },
        include: { phone: true, clientSecret: true },
      });

      await tx.phoneNumber.update({
        where: { id: createdPhone.id },
        data: { isVerified: createdUser.isVerified, deletedAt: null },
      });

      return createdUser;
    });

    return UserMapper.toDomain(raw);
  }

  async update(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<UserEntity> {
    const updateData: Prisma.UserUpdateInput = {
      firstName: data.firstName,
      lastName: data.lastName,
      metadata: data.metadata,
    };

    const raw = await this.prisma.user.update({
      where: { id: userId, deletedAt: null, isActive: true },
      data: updateData,
      include: { phone: true, clientSecret: true },
    });
    return UserMapper.toDomain(raw);
  }

  async updatePin(userId: string, pinHash: string): Promise<void> {
    await this.prisma.clientSecret.upsert({
      where: { clientId: userId },
      update: { secretHash: pinHash, failCount: 0, blockedUntil: null },
      create: { clientId: userId, secretHash: pinHash },
    });
  }

  async incrementPinFail(userId: string): Promise<void> {
    await this.prisma.clientSecret.update({
      where: { clientId: userId },
      data: { failCount: { increment: 1 } },
    });
  }

  async blockPin(userId: string, until: Date): Promise<void> {
    await this.prisma.clientSecret.update({
      where: { clientId: userId },
      data: { blockedUntil: until, failCount: 0 },
    });
  }

  async resetPinFail(userId: string): Promise<void> {
    await this.prisma.clientSecret.update({
      where: { clientId: userId },
      data: { failCount: 0, blockedUntil: null },
    });
  }

  async markVerified(userId: string): Promise<void> {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId, deletedAt: null, isActive: true },
      data: { isVerified: true },
      select: { id: true, phoneId: true, isVerified: true },
    });

    await this.prisma.phoneNumber.update({
      where: { id: updatedUser.phoneId },
      data: { isVerified: true, deletedAt: null },
    });
  }

  async updateMetadata(
    userId: string,
    metadata: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId, deletedAt: null, isActive: true },
      data: { metadata },
    });
  }

  async logAuthEvent(data: {
    event: string;
    userId?: string;
    channel?: string;
    ipAddress?: string;
    deviceInfo?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.authLog.create({
      data: {
        event: data.event,
        userId: data.userId,
        channel: data.channel,
        ipAddress: data.ipAddress,
        deviceInfo: data.deviceInfo,
        metadata: data.metadata,
      },
    });
  }

  async upsertDevice(data: {
    userId: string;
    fingerprint: string;
    platform: string;
    model?: string;
  }): Promise<string> {
    const existing = await this.prisma.device.findFirst({
      where: {
        userId: data.userId,
        fingerprint: data.fingerprint,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.device.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), isActive: true, model: data.model },
      });
      return existing.id;
    }

    const device = await this.prisma.device.create({
      data: {
        userId: data.userId,
        fingerprint: data.fingerprint,
        platform: data.platform,
        model: data.model,
        lastSeenAt: new Date(),
      },
    });
    return device.id;
  }

  async createDeviceAuth(data: {
    deviceId: string;
    userId: string;
    refreshTokenId: string;
  }): Promise<void> {
    await this.prisma.deviceAuthentication.create({
      data: {
        deviceId: data.deviceId,
        userId: data.userId,
        refreshTokenId: data.refreshTokenId,
        lastActiveAt: new Date(),
      },
    });
  }
}

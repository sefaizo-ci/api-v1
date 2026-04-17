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

    await this.prisma.phone.update({
      where: { id: user.phoneId },
      data: {
        isVerified: user.isVerified,
        deletedAt: null,
      },
    });

    await this.prisma.phoneRole.upsert({
      where: {
        phoneId_role: {
          phoneId: user.phoneId,
          role,
        },
      },
      update: {
        userId,
      },
      create: {
        phoneId: user.phoneId,
        userId,
        role,
      },
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
        phone: {
          number: phone,
          deletedAt: null,
        },
      },
      include: { phone: true },
    });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, isActive: true },
      include: { phone: true },
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
      const createdPhone = await tx.phone.upsert({
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
        include: { phone: true },
      });

      await tx.phone.update({
        where: { id: createdPhone.id },
        data: {
          isVerified: createdUser.isVerified,
          deletedAt: null,
        },
      });

      await tx.phoneRole.upsert({
        where: {
          phoneId_role: {
            phoneId: createdPhone.id,
            role: createdUser.role,
          },
        },
        update: {
          userId: createdUser.id,
        },
        create: {
          phoneId: createdPhone.id,
          userId: createdUser.id,
          role: createdUser.role,
        },
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
    const raw = await this.prisma.user.update({
      where: { id: userId, deletedAt: null, isActive: true },
      data,
      include: { phone: true },
    });
    return UserMapper.toDomain(raw);
  }

  async updatePin(userId: string, pinHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId, deletedAt: null, isActive: true },
      data: { pinHash },
    });
  }

  async incrementPinFail(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId, deletedAt: null, isActive: true },
      data: { pinFailCount: { increment: 1 } },
    });
  }

  async blockPin(userId: string, until: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId, deletedAt: null, isActive: true },
      data: { pinBlockedUntil: until, pinFailCount: 0 },
    });
  }

  async resetPinFail(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId, deletedAt: null, isActive: true },
      data: { pinFailCount: 0, pinBlockedUntil: null },
    });
  }

  async markVerified(userId: string): Promise<void> {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId, deletedAt: null, isActive: true },
      data: { isVerified: true },
      select: { id: true, phoneId: true, isVerified: true },
    });

    await this.prisma.phone.update({
      where: { id: updatedUser.phoneId },
      data: {
        isVerified: true,
        deletedAt: null,
      },
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
}

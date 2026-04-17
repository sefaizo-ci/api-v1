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

  async findByPhone(phone: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findFirst({
      where: { phone, deletedAt: null, isActive: true },
    });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, isActive: true },
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
    const raw = await this.prisma.user.create({
      data: {
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role ?? UserRole.CLIENT,
        metadata: data.metadata,
      },
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
    await this.prisma.user.update({
      where: { id: userId, deletedAt: null, isActive: true },
      data: { isVerified: true },
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

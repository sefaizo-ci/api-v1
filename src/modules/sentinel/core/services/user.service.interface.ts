import type { Prisma } from '@prisma/client';
import { UserEntity } from '../entities/user.entity';
import type { UserRole } from '../enums/auth.enums';

export interface IUserRepository {
  findByPhone(phone: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  getRolesByUserId(userId: string): Promise<UserRole[]>;
  assignRole(userId: string, role: UserRole): Promise<void>;
  hasProfessionalProfile(userId: string): Promise<boolean>;
  create(data: {
    phone: string;
    firstName: string;
    lastName: string;
    role?: Extract<UserRole, 'CLIENT' | 'PROFESSIONAL'>;
    metadata?: Prisma.InputJsonValue;
  }): Promise<UserEntity>;
  update(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<UserEntity>;
  updatePin(userId: string, pinHash: string): Promise<void>;
  incrementPinFail(userId: string): Promise<void>;
  blockPin(userId: string, until: Date): Promise<void>;
  resetPinFail(userId: string): Promise<void>;
  markVerified(userId: string): Promise<void>;
  updateMetadata(
    userId: string,
    metadata: Prisma.InputJsonValue,
  ): Promise<void>;
  logAuthEvent(data: {
    event: string;
    userId?: string;
    channel?: string;
    ipAddress?: string;
    deviceInfo?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void>;
  upsertDevice(data: {
    userId: string;
    fingerprint: string;
    platform: string;
    model?: string;
  }): Promise<string>;
  createDeviceAuth(data: {
    deviceId: string;
    userId: string;
    refreshTokenId: string;
  }): Promise<void>;
}

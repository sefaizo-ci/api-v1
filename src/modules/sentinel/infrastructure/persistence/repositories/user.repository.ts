import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../libs/database/prisma.service';
import { UserEntity } from '../../../core/entities/user.entity';
import { LoginApp, UserRole } from '../../../core/enums/auth.enums';
import {
  IUserRepository,
  OnboardingStep,
  PhoneRecord,
} from '../../../core/services/user.service.interface';
import { UserMapper } from '../../mappers/user.mapper';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPhoneByNumber(phone: string): Promise<PhoneRecord | null> {
    const raw = await this.prisma.phoneNumber.findUnique({
      where: { number: phone, deletedAt: null },
      select: {
        id: true,
        number: true,
        clientUserId: true,
        professionalUserId: true,
        isVerified: true,
      },
    });
    return raw ?? null;
  }

  async findOrCreatePhone(phone: string): Promise<PhoneRecord> {
    const raw = await this.prisma.phoneNumber.upsert({
      where: { number: phone },
      update: { deletedAt: null },
      create: { number: phone },
      select: {
        id: true,
        number: true,
        clientUserId: true,
        professionalUserId: true,
        isVerified: true,
      },
    });
    return raw;
  }

  async findByPhone(phone: string, app: LoginApp): Promise<UserEntity | null> {
    const phoneRecord = await this.prisma.phoneNumber.findUnique({
      where: { number: phone, deletedAt: null },
      select: { clientUserId: true, professionalUserId: true },
    });
    if (!phoneRecord) return null;

    const userId =
      app === UserRole.CLIENT
        ? phoneRecord.clientUserId
        : phoneRecord.professionalUserId;
    if (!userId) return null;

    return this.findById(userId);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, isActive: true },
      include: { phone: true, clientSecret: true },
    });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findUserById(
    id: string,
  ): Promise<{ id: string; role: UserRole; isActive: boolean } | null> {
    const raw = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isActive: true, deletedAt: true },
    });
    if (!raw || raw.deletedAt !== null) return null;
    return { id: raw.id, role: raw.role, isActive: raw.isActive };
  }

  async createAndLinkUser(data: {
    phoneId: string;
    app: LoginApp;
    firstName: string;
    lastName: string;
    pinHash: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<{ user: UserEntity; professionalId: string | null }> {
    const { raw, professionalId } = await this.prisma.$transaction(
      async (tx) => {
        // Lock the phone row and check for race condition
        const phone = await tx.phoneNumber.findUniqueOrThrow({
          where: { id: data.phoneId },
          select: { clientUserId: true, professionalUserId: true },
        });

        const slotTaken =
          data.app === UserRole.CLIENT
            ? phone.clientUserId
            : phone.professionalUserId;

        if (slotTaken) {
          throw new ConflictException(
            `Un compte ${data.app} existe déjà pour ce numéro.`,
          );
        }

        // Create the User
        const user = await tx.user.create({
          data: {
            phoneId: data.phoneId,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.app,
            isVerified: true,
            isActive: true,
            metadata: data.metadata,
          },
        });

        // Create the ClientSecret (PIN)
        await tx.clientSecret.create({
          data: { clientId: user.id, secretHash: data.pinHash },
        });

        // Link PhoneNumber → User
        await tx.phoneNumber.update({
          where: { id: data.phoneId },
          data:
            data.app === UserRole.CLIENT
              ? { clientUserId: user.id }
              : { professionalUserId: user.id },
        });

        // Create Professional profile for PROFESSIONAL accounts
        let professionalId: string | null = null;
        if (data.app === UserRole.PROFESSIONAL) {
          const professional = await tx.professional.create({
            data: { userId: user.id, agencyName: '' },
            select: { id: true },
          });
          professionalId = professional.id;
        }

        const raw = await tx.user.findUniqueOrThrow({
          where: { id: user.id },
          include: { phone: true, clientSecret: true },
        });

        return { raw, professionalId };
      },
    );

    return { user: UserMapper.toDomain(raw), professionalId };
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

  async markPhoneVerified(phoneId: string): Promise<void> {
    await this.prisma.phoneNumber.update({
      where: { id: phoneId },
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

  async logAuthEvent(data: {
    event: string;
    userId?: string;
    channel?: string;
    ipAddress?: string;
    deviceInfo?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.authLog.create({ data });
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

  async hasProfessionalProfile(userId: string): Promise<boolean> {
    const profile = await this.prisma.professional.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    return Boolean(profile);
  }

  async getProfessionalId(userId: string): Promise<string | null> {
    const profile = await this.prisma.professional.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  async getOnboardingStep(userId: string): Promise<OnboardingStep> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: {
        firstName: true,
        acceptedTermsAt: true,
        onboardingCompletedAt: true,
        professional: {
          where: { deletedAt: null },
          select: {
            address: true,
            availabilities: { select: { id: true }, take: 1 },
            services: {
              where: { isActive: true, deletedAt: null },
              select: { id: true },
              take: 1,
            },
            gallery: {
              where: { deletedAt: null },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!user) return 'PROFILE_PENDING';
    if (user.onboardingCompletedAt) return 'COMPLETED';
    if (!user.firstName || user.firstName.trim() === '')
      return 'PROFILE_PENDING';
    if (!user.professional) return 'ESTABLISHMENT_PENDING';
    if (!user.professional.address) return 'LOCATION_PENDING';
    if (!user.professional.availabilities.length) return 'AVAILABILITY_PENDING';
    if (!user.professional.services.length) return 'SERVICES_PENDING';
    if (!user.professional.gallery.length) return 'GALLERY_PENDING';
    if (!user.acceptedTermsAt) return 'TERMS_PENDING';
    return 'COMPLETED';
  }

  async completeOnboarding(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId, deletedAt: null, isActive: true },
      data: { onboardingCompletedAt: new Date() },
    });
  }

  async acceptTerms(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId, deletedAt: null, isActive: true },
      data: { acceptedTermsAt: new Date() },
    });
  }
}

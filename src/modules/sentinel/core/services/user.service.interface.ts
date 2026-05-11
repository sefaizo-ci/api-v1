import type { Prisma } from '@prisma/client';
import { UserEntity } from '../entities/user.entity';
import type { LoginApp, UserRole } from '../enums/auth.enums';

export type OnboardingStep =
  | 'PROFILE_PENDING' // PIN créé, nom manquant
  | 'ESTABLISHMENT_PENDING' // Nom OK, profil pro manquant (type + infos)
  | 'LOCATION_PENDING' // Profil pro créé, localisation manquante
  | 'AVAILABILITY_PENDING' // Localisation OK, horaires manquants
  | 'SERVICES_PENDING' // Horaires OK, services manquants
  | 'GALLERY_PENDING' // Services OK, galerie manquante
  | 'TERMS_PENDING' // Galerie OK, CGU non acceptées
  | 'COMPLETED'; // Tout complété

export type PhoneRecord = {
  id: string;
  number: string;
  clientUserId: string | null;
  professionalUserId: string | null;
  isVerified: boolean;
};

export interface IUserRepository {
  // Phone lookups
  findPhoneByNumber(phone: string): Promise<PhoneRecord | null>;
  findOrCreatePhone(phone: string): Promise<PhoneRecord>;

  // User lookups — always scoped to an app (CLIENT or PROFESSIONAL)
  findByPhone(phone: string, app: LoginApp): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;

  // Account creation — creates User + links to PhoneNumber in a transaction
  createAndLinkUser(data: {
    phoneId: string;
    app: LoginApp;
    firstName: string;
    lastName: string;
    pinHash: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<{ user: UserEntity; professionalId: string | null }>;

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
  markPhoneVerified(phoneId: string): Promise<void>;
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

  hasProfessionalProfile(userId: string): Promise<boolean>;
  getProfessionalId(userId: string): Promise<string | null>;
  getOnboardingStep(userId: string): Promise<OnboardingStep>;
  acceptTerms(userId: string): Promise<void>;
  completeOnboarding(userId: string): Promise<void>;

  // Legacy — kept for JWT strategy validate()
  findUserById(
    id: string,
  ): Promise<{ id: string; role: UserRole; isActive: boolean } | null>;
}

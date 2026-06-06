import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../libs/database/prisma.service';
import { ProfessionalEntity } from '../../core/entities/professional.entity';
import { IProfessionalRepository } from '../../core/repositories/professional.repository';
import { ProfessionalMapper } from '../mappers/professional.mapper';

/**
 * ProfessionalRepository
 * Concrete implementation using Prisma ORM
 */
@Injectable()
export class ProfessionalRepository implements IProfessionalRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    filters?: {
      status?: string;
      isVerified?: boolean;
      isListingActive?: boolean;
      location?: string;
      search?: string;
      rating?: number;
    },
    clientFacing = false,
  ): Prisma.ProfessionalWhereInput {
    const where: Prisma.ProfessionalWhereInput = { deletedAt: null };

    if (filters?.status) where.status = filters.status;
    if (filters?.isVerified !== undefined) {
      where.isVerified = filters.isVerified;
    }
    if (filters?.isListingActive !== undefined) {
      where.isListingActive = filters.isListingActive;
    }
    if (filters?.location) {
      where.location =
        filters.location as Prisma.ProfessionalWhereInput['location'];
    }
    if (filters?.rating !== undefined) {
      where.rating = { gte: filters.rating };
    }

    // SALON pros without address are not shown to clients (no location = not findable)
    // HOME and BOTH pros remain visible even without address (they go to the client)
    if (clientFacing) {
      where.NOT = {
        AND: [{ location: 'SALON' }, { address: null }],
      };
    }

    const search = filters?.search?.trim();
    if (search) {
      where.OR = [
        {
          agencyName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          bio: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          services: {
            some: {
              deletedAt: null,
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    return where;
  }

  private async fetchProfessionals(
    where: Prisma.ProfessionalWhereInput,
    pagination?: {
      skip?: number;
      take?: number;
    },
  ): Promise<ProfessionalEntity[]> {
    const raws = await this.prisma.professional.findMany({
      where,
      include: {
        services: {
          where: { deletedAt: null },
          include: {
            communeFees: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        availabilities: {
          where: { deletedAt: null },
        },
        gallery: {
          where: { deletedAt: null },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination?.skip,
      take: pagination?.take,
    });

    return raws.map((raw) => ProfessionalMapper.toDomain(raw));
  }

  async save(professional: ProfessionalEntity): Promise<void> {
    const persistenceData = ProfessionalMapper.toPersistence(professional);

    const operations: Prisma.PrismaPromise<unknown>[] = [];

    operations.push(
      this.prisma.professional.upsert({
        where: { id: professional.id },
        update: persistenceData,
        create: persistenceData,
      }),
    );

    for (const service of professional.services) {
      operations.push(
        this.prisma.serviceOffering.upsert({
          where: { id: service.id },
          update: {
            name: service.name,
            description: service.description,
            imageUrl: service.imageUrl ?? null,
            durationMin: service.durationMin,
            basePrice: service.basePrice,
            category: {
              connect: {
                name: service.category,
              },
            },
            isActive: service.isActive,
            deletedAt: service.deletedAt ?? null,
            updatedAt: service.updatedAt,
          },
          create: {
            id: service.id,
            professional: {
              connect: {
                id: professional.id,
              },
            },
            name: service.name,
            description: service.description,
            imageUrl: service.imageUrl ?? null,
            durationMin: service.durationMin,
            basePrice: service.basePrice,
            category: {
              connect: {
                name: service.category,
              },
            },
            isActive: service.isActive,
            deletedAt: service.deletedAt ?? null,
            createdAt: service.createdAt,
            updatedAt: service.updatedAt,
            metadata: {},
          },
        }),
      );

      for (const communeFee of service.communeFees) {
        operations.push(
          this.prisma.communeFee.upsert({
            where: {
              serviceOfferingId_commune: {
                serviceOfferingId: service.id,
                commune: communeFee.commune,
              },
            },
            update: {
              travelFee: communeFee.travelFee,
              isAvailable: communeFee.isAvailable,
              deletedAt: null,
              updatedAt: new Date(),
            },
            create: {
              id: randomUUID(),
              serviceOfferingId: service.id,
              commune: communeFee.commune,
              travelFee: communeFee.travelFee,
              isAvailable: communeFee.isAvailable,
              metadata: {},
            },
          }),
        );
      }
    }

    for (const availability of professional.availabilities) {
      operations.push(
        this.prisma.availability.upsert({
          where: { id: availability.id },
          update: {
            dayOfWeek: availability.dayOfWeek,
            startTime: availability.workingHours.startTime,
            endTime: availability.workingHours.endTime,
            breakStartTime: availability.breakTime?.startTime,
            breakEndTime: availability.breakTime?.endTime,
            status: availability.status,
            isActive: availability.isActive,
            deletedAt: availability.deletedAt ?? null,
            updatedAt: availability.updatedAt,
          },
          create: {
            id: availability.id,
            professionalId: professional.id,
            dayOfWeek: availability.dayOfWeek,
            startTime: availability.workingHours.startTime,
            endTime: availability.workingHours.endTime,
            breakStartTime: availability.breakTime?.startTime,
            breakEndTime: availability.breakTime?.endTime,
            status: availability.status,
            isActive: availability.isActive,
            deletedAt: availability.deletedAt ?? null,
            createdAt: availability.createdAt,
            updatedAt: availability.updatedAt,
            metadata: {},
          },
        }),
      );
    }

    for (const galleryItem of professional.gallery) {
      operations.push(
        this.prisma.$executeRaw`
          INSERT INTO "gallery_items" (
            "id",
            "professionalId",
            "imageUrl",
            "caption",
            "category",
            "order",
            "isPublic",
            "deletedAt",
            "createdAt",
            "updatedAt",
            "metadata"
          ) VALUES (
            ${galleryItem.id},
            ${professional.id},
            ${galleryItem.imageUrl},
            ${galleryItem.caption},
            ${galleryItem.category},
            ${galleryItem.order},
            ${galleryItem.isPublic},
            ${galleryItem.deletedAt ?? null},
            ${galleryItem.createdAt},
            ${galleryItem.updatedAt},
            '{}'::jsonb
          )
          ON CONFLICT ("id") DO UPDATE SET
            "professionalId" = EXCLUDED."professionalId",
            "imageUrl" = EXCLUDED."imageUrl",
            "caption" = EXCLUDED."caption",
            "category" = EXCLUDED."category",
            "order" = EXCLUDED."order",
            "isPublic" = EXCLUDED."isPublic",
            "deletedAt" = EXCLUDED."deletedAt",
            "updatedAt" = EXCLUDED."updatedAt"
        `,
      );
    }

    await this.prisma.$transaction(operations);
  }

  async findById(id: string): Promise<ProfessionalEntity | null> {
    const raw = await this.prisma.professional.findUnique({
      where: { id },
      include: {
        services: {
          where: { deletedAt: null },
          include: {
            communeFees: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        availabilities: {
          where: { deletedAt: null },
        },
        gallery: {
          where: { deletedAt: null },
        },
      },
    });

    if (!raw) return null;
    return ProfessionalMapper.toDomain(raw);
  }

  async findByUserId(userId: string): Promise<ProfessionalEntity | null> {
    const raw = await this.prisma.professional.findUnique({
      where: { userId },
      include: {
        services: {
          where: { deletedAt: null },
          include: {
            communeFees: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        availabilities: {
          where: { deletedAt: null },
        },
        gallery: {
          where: { deletedAt: null },
        },
      },
    });

    if (!raw) return null;
    return ProfessionalMapper.toDomain(raw);
  }

  async findAll(filters?: {
    status?: string;
    isVerified?: boolean;
    isListingActive?: boolean;
    location?: string;
  }): Promise<ProfessionalEntity[]> {
    return this.fetchProfessionals(this.buildWhere(filters));
  }

  async findAllPaginated(
    filters?: {
      status?: string;
      isVerified?: boolean;
      isListingActive?: boolean;
      location?: string;
      search?: string;
      rating?: number;
    },
    pagination?: {
      page?: number;
      limit?: number;
    },
    clientFacing = false,
  ): Promise<{
    data: ProfessionalEntity[];
    total: number;
  }> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters, clientFacing);

    const [data, total] = await Promise.all([
      this.fetchProfessionals(where, { skip, take: limit }),
      this.prisma.professional.count({ where }),
    ]);

    return { data, total };
  }

  async findEligibleForAutoVerification(): Promise<ProfessionalEntity[]> {
    const raws = await this.prisma.professional.findMany({
      where: {
        deletedAt: null,
        status: 'PENDING',
        isVerified: false,
        agencyName: { not: '' },
        avatarUrl: { not: null },
        bio: { not: null },
        services: { some: { deletedAt: null, isActive: true } },
      },
      include: {
        services: {
          where: { deletedAt: null },
          include: {
            communeFees: true,
            category: { select: { id: true, name: true } },
          },
        },
        availabilities: { where: { deletedAt: null } },
        gallery: { where: { deletedAt: null } },
      },
    });
    // Filter in-memory for mainCategories (array field not filterable via Prisma)
    return raws
      .filter((raw) => (raw.mainCategories?.length ?? 0) > 0)
      .map((raw) => ProfessionalMapper.toDomain(raw));
  }

  async findIncompleteAfterGracePeriod(
    gracePeriodHours: number,
  ): Promise<ProfessionalEntity[]> {
    const cutoff = new Date(Date.now() - gracePeriodHours * 3600 * 1000);
    // Fetch all pending professionals past grace period and filter in-memory
    // because Prisma cannot filter on empty arrays (mainCategories = [])
    const raws = await this.prisma.professional.findMany({
      where: {
        deletedAt: null,
        status: 'PENDING',
        isVerified: false,
        createdAt: { lte: cutoff },
      },
      include: {
        services: {
          where: { deletedAt: null },
          include: {
            communeFees: true,
            category: { select: { id: true, name: true } },
          },
        },
        availabilities: { where: { deletedAt: null } },
        gallery: { where: { deletedAt: null } },
      },
    });

    return raws
      .filter((raw) => {
        const hasBlockingSteps =
          !!raw.agencyName?.trim() &&
          !!raw.avatarUrl &&
          !!raw.bio?.trim() &&
          (raw.mainCategories?.length ?? 0) > 0 &&
          raw.services.some((s) => s.isActive && !s.deletedAt);
        return !hasBlockingSteps;
      })
      .map((raw) => ProfessionalMapper.toDomain(raw));
  }

  async findWithExpiredBookingPause(): Promise<ProfessionalEntity[]> {
    const now = new Date();
    const raws = await this.prisma.professional.findMany({
      where: {
        deletedAt: null,
        isAcceptingBookings: false,
        bookingsPausedUntil: { lte: now },
      },
      include: {
        services: {
          where: { deletedAt: null },
          include: {
            communeFees: true,
            category: { select: { id: true, name: true } },
          },
        },
        availabilities: { where: { deletedAt: null } },
        gallery: { where: { deletedAt: null } },
      },
    });
    return raws.map((raw) => ProfessionalMapper.toDomain(raw));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.professional.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.prisma.professional.findUnique({
      where: { id },
    });
    return result !== null && result.deletedAt === null;
  }

  async hasProfile(userId: string): Promise<boolean> {
    const result = await this.prisma.professional.findUnique({
      where: { userId },
    });
    return result !== null && result.deletedAt === null;
  }
}

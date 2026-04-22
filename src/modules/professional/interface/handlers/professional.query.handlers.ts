import { Injectable, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../libs/database/prisma.service';
import { ProfessionalRepository } from '../../infrastructure/persistence/professional.repository';
import {
  GetMyProfessionalProfileQuery,
  GetProfessionalAvailabilityQuery,
  GetProfessionalBookingsQuery,
  GetProfessionalGalleryQuery,
  GetProfessionalProfileQuery,
  GetProfessionalServicesQuery,
  GetProfileCompletionQuery,
  ListProfessionalsQuery,
  ListServiceCategoriesQuery,
  SearchProfessionalsQuery,
} from '../../interface/queries';

type ServiceCategoryRecord = {
  id: string;
  professionalId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  metadata: Prisma.JsonValue | null;
};

type ProfessionalQueryPrisma = {
  serviceCategory: {
    findMany(args: {
      where: {
        professionalId: string;
        isActive: true;
        deletedAt: null;
      };
      orderBy: {
        name: 'asc';
      };
    }): Promise<ServiceCategoryRecord[]>;
  };
};

function toQueryPrismaFacade(
  prisma: PrismaService,
): PrismaService & ProfessionalQueryPrisma {
  return prisma as PrismaService & ProfessionalQueryPrisma;
}

@QueryHandler(ListServiceCategoriesQuery)
@Injectable()
export class ListServiceCategoriesHandler implements IQueryHandler<ListServiceCategoriesQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListServiceCategoriesQuery): Promise<{
    data: ServiceCategoryRecord[];
    count: number;
  }> {
    const prisma = toQueryPrismaFacade(this.prisma);
    const categories = await prisma.serviceCategory.findMany({
      where: {
        professionalId: query.professionalId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return {
      data: categories,
      count: categories.length,
    };
  }
}

@QueryHandler(GetMyProfessionalProfileQuery)
@Injectable()
export class GetMyProfessionalProfileHandler implements IQueryHandler<GetMyProfessionalProfileQuery> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(query: GetMyProfessionalProfileQuery) {
    const professional = await this.repository.findByUserId(query.userId);
    if (!professional) {
      throw new NotFoundException('Profil professionnel non trouvé');
    }

    return professional.getSummary();
  }
}

@QueryHandler(GetProfessionalProfileQuery)
@Injectable()
export class GetProfessionalProfileHandler implements IQueryHandler<GetProfessionalProfileQuery> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(query: GetProfessionalProfileQuery) {
    const professional = await this.repository.findById(query.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    return {
      ...professional.getSummary(),
      bio: professional.bio,
      avatarUrl: professional.avatarUrl,
      location: professional.location,
      address: professional.address,
      services: professional.getActiveServices(),
      availability: professional.getActiveAvailabilities(),
      gallery: professional.getPublicGallery(),
    };
  }
}

@QueryHandler(ListProfessionalsQuery)
@Injectable()
export class ListProfessionalsHandler implements IQueryHandler<ListProfessionalsQuery> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(query: ListProfessionalsQuery) {
    const professionals = await this.repository.findAll({
      status: query.filters?.status,
      isVerified: query.filters?.isVerified,
      location: query.filters?.location,
    });

    const page = query.page || 1;
    const limit = query.limit || 20;
    const startIndex = (page - 1) * limit;
    const paginated = professionals.slice(startIndex, startIndex + limit);

    return {
      data: paginated.map((p) => p.getSummary()),
      pagination: {
        page,
        limit,
        total: professionals.length,
        totalPages: Math.ceil(professionals.length / limit),
      },
    };
  }
}

@QueryHandler(GetProfessionalServicesQuery)
@Injectable()
export class GetProfessionalServicesHandler implements IQueryHandler<GetProfessionalServicesQuery> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(query: GetProfessionalServicesQuery) {
    const professional = await this.repository.findById(query.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    const services = query.includeInactive
      ? professional.services.filter((s) => !s.deletedAt)
      : professional.getActiveServices();

    return {
      professionalId: professional.id,
      services,
      count: services.length,
    };
  }
}

@QueryHandler(GetProfessionalAvailabilityQuery)
@Injectable()
export class GetProfessionalAvailabilityHandler implements IQueryHandler<GetProfessionalAvailabilityQuery> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(query: GetProfessionalAvailabilityQuery) {
    const professional = await this.repository.findById(query.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    if (query.dayOfWeek !== undefined) {
      const dayAvailability = professional.getAvailability(query.dayOfWeek);
      return {
        professionalId: professional.id,
        dayOfWeek: query.dayOfWeek,
        availability: dayAvailability,
      };
    }

    return {
      professionalId: professional.id,
      availabilities: professional.getActiveAvailabilities(),
      count: professional.getActiveAvailabilities().length,
    };
  }
}

@QueryHandler(GetProfessionalGalleryQuery)
@Injectable()
export class GetProfessionalGalleryHandler implements IQueryHandler<GetProfessionalGalleryQuery> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(query: GetProfessionalGalleryQuery) {
    const professional = await this.repository.findById(query.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    const gallery = professional.getPublicGallery();
    const page = query.page || 1;
    const limit = query.limit || 20;
    const startIndex = (page - 1) * limit;
    const paginated = gallery.slice(startIndex, startIndex + limit);

    return {
      professionalId: professional.id,
      data: paginated,
      pagination: {
        page,
        limit,
        total: gallery.length,
        totalPages: Math.ceil(gallery.length / limit),
      },
    };
  }
}

@QueryHandler(GetProfessionalBookingsQuery)
@Injectable()
export class GetProfessionalBookingsHandler implements IQueryHandler<GetProfessionalBookingsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetProfessionalBookingsQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      professionalId: query.professionalId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status as BookingStatus;
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              durationMin: true,
              basePrice: true,
            },
          },
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

@QueryHandler(GetProfileCompletionQuery)
@Injectable()
export class GetProfileCompletionHandler implements IQueryHandler<GetProfileCompletionQuery> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(query: GetProfileCompletionQuery) {
    const professional = await this.repository.findById(query.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    return {
      professionalId: professional.id,
      completion: professional.getProfileCompletion(),
      summary: professional.getSummary(),
    };
  }
}

@QueryHandler(SearchProfessionalsQuery)
@Injectable()
export class SearchProfessionalsHandler implements IQueryHandler<SearchProfessionalsQuery> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(query: SearchProfessionalsQuery) {
    const professionals = await this.repository.findAll({
      isVerified: true,
      status: 'ACTIVE',
      location: query.location,
    });

    // Basic search implementation
    const filtered = professionals.filter((p) => {
      const searchTerm = query.search.toLowerCase();
      return (
        p.agencyName.toLowerCase().includes(searchTerm) ||
        p.bio?.toLowerCase().includes(searchTerm) ||
        p.services.some((s) => s.name.toLowerCase().includes(searchTerm))
      );
    });

    // Filter by rating if provided
    const ratingFiltered = query.rating
      ? filtered.filter((p) => p.rating >= query.rating!)
      : filtered;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const startIndex = (page - 1) * limit;
    const paginated = ratingFiltered.slice(startIndex, startIndex + limit);

    return {
      data: paginated.map((p) => p.getSummary()),
      pagination: {
        page,
        limit,
        total: ratingFiltered.length,
        totalPages: Math.ceil(ratingFiltered.length / limit),
      },
    };
  }
}

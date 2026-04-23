import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  BookingStatus,
  Prisma,
  ServiceCategoryRequestStatus,
} from '@prisma/client';
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
  ListBookingCancellationRequestsQuery,
  ListProfessionalsQuery,
  ListServiceCategoriesQuery,
  ListServiceCategoryRequestsQuery,
  SearchProfessionalsQuery,
} from '../../interface/queries';

const BOOKING_CANCELLATION_REQUEST_STATUS_PENDING = 'PENDING' as const;

type ServiceCategoryRecord = {
  id: string;
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
        isActive: true;
        deletedAt: null;
      };
      orderBy: {
        name: 'asc';
      };
      skip?: number;
      take?: number;
    }): Promise<ServiceCategoryRecord[]>;
    count(args: {
      where: {
        isActive: true;
        deletedAt: null;
      };
    }): Promise<number>;
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
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const prisma = toQueryPrismaFacade(this.prisma);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: { isActive: true; deletedAt: null } = {
      isActive: true,
      deletedAt: null,
    };

    const [categories, total] = await Promise.all([
      prisma.serviceCategory.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.serviceCategory.count({ where }),
    ]);

    return {
      data: categories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

@QueryHandler(ListServiceCategoryRequestsQuery)
@Injectable()
export class ListServiceCategoryRequestsHandler implements IQueryHandler<ListServiceCategoryRequestsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListServiceCategoryRequestsQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceCategoryRequestWhereInput = {
      deletedAt: null,
    };

    if (query.professionalId) {
      if (query.requesterUserId) {
        const ownedProfessional = await this.prisma.professional.findFirst({
          where: {
            id: query.professionalId,
            userId: query.requesterUserId,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!ownedProfessional) {
          throw new ForbiddenException(
            'Vous ne pouvez consulter que vos propres demandes',
          );
        }
      }

      where.professionalId = query.professionalId;
    }

    if (query.status) {
      where.status = query.status as ServiceCategoryRequestStatus;
    }

    const [requests, total] = await Promise.all([
      this.prisma.serviceCategoryRequest.findMany({
        where,
        include: {
          professional: {
            select: {
              id: true,
              agencyName: true,
            },
          },
          reviewedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          approvedCategory: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.serviceCategoryRequest.count({ where }),
    ]);

    return {
      data: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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

@QueryHandler(ListBookingCancellationRequestsQuery)
@Injectable()
export class ListBookingCancellationRequestsHandler implements IQueryHandler<ListBookingCancellationRequestsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListBookingCancellationRequestsQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      professionalId: query.professionalId,
      status: BookingStatus.CONFIRMED,
      cancellationRequestStatus: BOOKING_CANCELLATION_REQUEST_STATUS_PENDING,
      deletedAt: null,
    };

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
        orderBy: { cancellationRequestedAt: 'asc' },
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

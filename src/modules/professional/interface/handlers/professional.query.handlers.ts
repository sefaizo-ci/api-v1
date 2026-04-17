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
  SearchProfessionalsQuery,
} from '../../interface/queries';

/**
 * GetMyProfessionalProfileHandler
 * Query handler to fetch current user's professional profile
 */
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

/**
 * GetProfessionalProfileHandler
 * Query handler to fetch a specific professional profile by ID
 */
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

/**
 * ListProfessionalsHandler
 * Query handler to list professionals with filters
 */
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

/**
 * GetProfessionalServicesHandler
 * Query handler to fetch services for a professional
 */
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

/**
 * GetProfessionalAvailabilityHandler
 * Query handler to fetch availability schedule
 */
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

/**
 * GetProfessionalGalleryHandler
 * Query handler to fetch gallery items
 */
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

/**
 * GetProfessionalBookingsHandler
 * Query handler to fetch bookings for professional side management
 */
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

/**
 * GetProfileCompletionHandler
 * Query handler to get profile completion percentage
 */
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

/**
 * SearchProfessionalsHandler
 * Query handler for professional search
 */
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

    // Pagination
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

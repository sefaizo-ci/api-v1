import {
  BadRequestException,
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
  GetAvailableSlotsQuery,
  GetMyProfessionalProfileQuery,
  GetNewProfessionalsQuery,
  GetProfessionalAvailabilityQuery,
  GetProfessionalBookingsCalendarQuery,
  GetProfessionalBookingsQuery,
  GetProfessionalGalleryQuery,
  GetProfessionalProfileQuery,
  GetProfessionalRevenueSummaryQuery,
  GetProfessionalServicesQuery,
  GetProfileCompletionQuery,
  GetRecommendedProfessionalsQuery,
  GetTrendingProfessionalsQuery,
  ListBookingCancellationRequestsQuery,
  ListProfessionalsQuery,
  ListServiceCategoriesQuery,
  ListServiceCategoryRequestsQuery,
  SearchProfessionalsQuery,
} from '../../interface/queries';

const BOOKING_CANCELLATION_REQUEST_STATUS_PENDING = 'PENDING' as const;

type GeoRow = { id: string; distance_km: string | null };

type DiscoveryItem = {
  id: string;
  agencyName: string | null;
  avatarUrl: string | null;
  address: string | null;
  location: string;
  latitude: number | null;
  longitude: number | null;
  bio: string | null;
  status: string;
  isVerified: boolean;
  rating: number;
  reviewCount: number;
  minPrice: number | null;
  serviceCount: number;
  availabilityCount: number;
  galleryCount: number;
  canAcceptBookings: boolean;
  distanceKm: number | null;
};

type DiscoveryPage = {
  data: DiscoveryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type GeoQueryOpts = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  commune?: string;
  limit?: number;
  page?: number;
};

async function runGeoDiscovery(
  prisma: PrismaService,
  opts: GeoQueryOpts,
  extraWhere: string,
  orderBy: string,
): Promise<DiscoveryPage> {
  const km = opts.radiusKm ?? 10;
  const limit = opts.limit ?? 10;
  const page = opts.page ?? 1;
  const offset = (page - 1) * limit;
  const hasCoords = opts.lat !== undefined && opts.lng !== undefined;
  const lat = opts.lat ?? 0;
  const lng = opts.lng ?? 0;

  const distExpr = hasCoords
    ? `ROUND(CAST(6371 * acos(LEAST(1.0, cos(radians(${lat})) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(p.latitude)))) AS numeric), 1)`
    : 'NULL';
  const geoWhere = hasCoords
    ? `AND (6371 * acos(LEAST(1.0, cos(radians(${lat})) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(p.latitude))))) <= ${km}`
    : '';
  const comWhere = opts.commune
    ? `AND p.address ILIKE '%${opts.commune.replace(/'/g, "''")}%'`
    : '';

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<GeoRow[]>(
      Prisma.sql`
        SELECT p.id, ${Prisma.raw(distExpr)} AS distance_km
        FROM "public"."professionals" p
        WHERE p."deletedAt" IS NULL
          AND p.status = 'ACTIVE'
          AND p."isVerified" = true
          AND NOT (p.location = 'SALON' AND p.address IS NULL)
          ${Prisma.raw(geoWhere)}
          ${Prisma.raw(comWhere)}
          ${Prisma.raw(extraWhere)}
        ORDER BY ${Prisma.raw(orderBy)}
        LIMIT ${Prisma.raw(String(limit))}
        OFFSET ${Prisma.raw(String(offset))}
      `,
    ),
    prisma.$queryRaw<[{ count: string }]>(
      Prisma.sql`
        SELECT COUNT(*) AS count
        FROM "public"."professionals" p
        WHERE p."deletedAt" IS NULL
          AND p.status = 'ACTIVE'
          AND p."isVerified" = true
          AND NOT (p.location = 'SALON' AND p.address IS NULL)
          ${Prisma.raw(geoWhere)}
          ${Prisma.raw(comWhere)}
          ${Prisma.raw(extraWhere)}
      `,
    ),
  ]);

  const total = parseInt(countRows[0]?.count ?? '0', 10);
  const pagination = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };

  if (rows.length === 0) return { data: [], pagination };

  const ids = rows.map((r) => r.id);
  const distMap = new Map(
    rows.map((r) => [
      r.id,
      r.distance_km !== null ? parseFloat(r.distance_km) : null,
    ]),
  );

  const [professionals, minPriceRows] = await Promise.all([
    prisma.professional.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        agencyName: true,
        avatarUrl: true,
        address: true,
        location: true,
        latitude: true,
        longitude: true,
        bio: true,
        status: true,
        isVerified: true,
        rating: true,
        reviewCount: true,
        deletedAt: true,
        _count: {
          select: {
            services: { where: { deletedAt: null, isActive: true } },
            availabilities: { where: { deletedAt: null, isActive: true } },
            gallery: { where: { deletedAt: null, isPublic: true } },
          },
        },
      },
    }),
    prisma.serviceOffering.groupBy({
      by: ['professionalId'],
      where: { professionalId: { in: ids }, isActive: true, deletedAt: null },
      _min: { basePrice: true },
    }),
  ]);

  const proMap = new Map(professionals.map((p) => [p.id, p]));
  const minPriceMap = new Map(
    minPriceRows.map((r) => [r.professionalId, r._min.basePrice]),
  );

  const data = ids
    .filter((id) => proMap.has(id))
    .map((id): DiscoveryItem => {
      const p = proMap.get(id)!;
      return {
        id: p.id,
        agencyName: p.agencyName,
        avatarUrl: p.avatarUrl,
        address: p.address,
        location: p.location,
        latitude: p.latitude,
        longitude: p.longitude,
        bio: p.bio,
        status: p.status,
        isVerified: p.isVerified,
        rating: p.rating,
        reviewCount: p.reviewCount,
        minPrice: minPriceMap.get(id) ?? null,
        serviceCount: p._count.services,
        availabilityCount: p._count.availabilities,
        galleryCount: p._count.gallery,
        canAcceptBookings:
          p.isVerified &&
          p.status === 'ACTIVE' &&
          !p.deletedAt &&
          p._count.services > 0 &&
          p._count.availabilities > 0,
        distanceKm: distMap.get(id) ?? null,
      };
    });

  return { data, pagination };
}

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

type RevenuePeriodSummary = {
  from: string;
  to: string;
  completedBookings: number;
  grossRevenue: number;
  travelRevenue: number;
  serviceRevenue: number;
  averageRevenuePerBooking: number;
};

type RevenueComparison = {
  grossRevenueDifference: number;
  grossRevenueDifferencePercent: number | null;
  completedBookingsDifference: number;
  completedBookingsDifferencePercent: number | null;
};

function toMoney(value: number | null | undefined): number {
  return Math.round((value ?? 0) * 100) / 100;
}

function toPercentageChange(
  currentValue: number,
  previousValue: number,
): number | null {
  if (previousValue === 0) return currentValue === 0 ? 0 : null;
  return (
    Math.round(((currentValue - previousValue) / previousValue) * 100 * 10) / 10
  );
}

function getMonthToDateWindows(now = new Date()) {
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  currentStart.setHours(0, 0, 0, 0);

  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  previousStart.setHours(0, 0, 0, 0);

  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  previousMonthEnd.setHours(23, 59, 59, 999);

  const elapsedMs = now.getTime() - currentStart.getTime();
  const previousCandidateEnd = new Date(previousStart.getTime() + elapsedMs);
  const previousEnd =
    previousCandidateEnd.getTime() > previousMonthEnd.getTime()
      ? previousMonthEnd
      : previousCandidateEnd;

  return {
    current: {
      from: currentStart,
      to: now,
    },
    previous: {
      from: previousStart,
      to: previousEnd,
    },
  };
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
    const page = query.page || 1;
    const limit = query.limit || 20;

    const { data, total } = await this.repository.findAllPaginated(
      {
        status: query.filters?.status,
        isVerified: query.filters?.isVerified,
        location: query.filters?.location,
      },
      {
        page,
        limit,
      },
    );

    return {
      data: data.map((p) => p.getSummary()),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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

    const availabilities = professional.getActiveAvailabilities();
    return {
      professionalId: professional.id,
      availabilities,
      count: availabilities.length,
    };
  }
}

@QueryHandler(GetProfessionalGalleryQuery)
@Injectable()
export class GetProfessionalGalleryHandler implements IQueryHandler<GetProfessionalGalleryQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetProfessionalGalleryQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const where = {
      professionalId: query.professionalId,
      isPublic: true,
      deletedAt: null,
    };

    const [data, total] = await Promise.all([
      this.prisma.galleryItem.findMany({
        where,
        orderBy: { order: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.galleryItem.count({ where }),
    ]);

    return {
      professionalId: query.professionalId,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
      const validStatuses = Object.values(BookingStatus);
      if (!validStatuses.includes(query.status as BookingStatus)) {
        throw new BadRequestException(
          `Invalid status "${query.status}". Valid values: ${validStatuses.join(', ')}`,
        );
      }
      where.status = query.status as BookingStatus;
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          client: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          service: {
            select: {
              id: true,
              name: true,
              durationMin: true,
              basePrice: true,
            },
          },
          bookingServices: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  durationMin: true,
                  basePrice: true,
                },
              },
            },
            orderBy: { order: 'asc' },
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
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          service: {
            select: {
              id: true,
              name: true,
              durationMin: true,
              basePrice: true,
            },
          },
          bookingServices: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  durationMin: true,
                  basePrice: true,
                },
              },
            },
            orderBy: { order: 'asc' },
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

@QueryHandler(GetProfessionalRevenueSummaryQuery)
@Injectable()
export class GetProfessionalRevenueSummaryHandler implements IQueryHandler<GetProfessionalRevenueSummaryQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: ProfessionalRepository,
  ) {}

  private async aggregateRevenue(
    professionalId: string,
    from: Date,
    to: Date,
  ): Promise<RevenuePeriodSummary> {
    const aggregate = await this.prisma.booking.aggregate({
      where: {
        professionalId,
        deletedAt: null,
        status: BookingStatus.COMPLETED,
        updatedAt: {
          gte: from,
          lte: to,
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        totalPrice: true,
        travelFee: true,
      },
    });

    const completedBookings = aggregate._count.id ?? 0;
    const grossRevenue = toMoney(aggregate._sum.totalPrice);
    const travelRevenue = toMoney(aggregate._sum.travelFee);
    const serviceRevenue = toMoney(grossRevenue - travelRevenue);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      completedBookings,
      grossRevenue,
      travelRevenue,
      serviceRevenue,
      averageRevenuePerBooking:
        completedBookings > 0 ? toMoney(grossRevenue / completedBookings) : 0,
    };
  }

  async execute(query: GetProfessionalRevenueSummaryQuery) {
    const professional = await this.repository.findByUserId(query.userId);
    if (!professional) {
      throw new NotFoundException('Profil professionnel non trouvé');
    }

    const now = new Date();
    const windows = getMonthToDateWindows(now);

    const [currentPeriod, previousPeriod] = await Promise.all([
      this.aggregateRevenue(
        professional.id,
        windows.current.from,
        windows.current.to,
      ),
      this.aggregateRevenue(
        professional.id,
        windows.previous.from,
        windows.previous.to,
      ),
    ]);

    const comparison: RevenueComparison = {
      grossRevenueDifference: toMoney(
        currentPeriod.grossRevenue - previousPeriod.grossRevenue,
      ),
      grossRevenueDifferencePercent: toPercentageChange(
        currentPeriod.grossRevenue,
        previousPeriod.grossRevenue,
      ),
      completedBookingsDifference:
        currentPeriod.completedBookings - previousPeriod.completedBookings,
      completedBookingsDifferencePercent: toPercentageChange(
        currentPeriod.completedBookings,
        previousPeriod.completedBookings,
      ),
    };

    return {
      professionalId: professional.id,
      currency: 'XOF',
      basis: 'BOOKING_COMPLETED_AT',
      generatedAt: now.toISOString(),
      currentPeriod,
      previousPeriod,
      comparison,
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
    const page = query.page || 1;
    const limit = query.limit || 20;
    const search = query.search.trim();

    const { data, total } = await this.repository.findAllPaginated(
      {
        isVerified: true,
        status: 'ACTIVE',
        location: query.location,
        search,
        rating: query.rating,
      },
      {
        page,
        limit,
      },
      true,
    );

    return {
      data: data.map((p) => p.getSummary()),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

@QueryHandler(GetRecommendedProfessionalsQuery)
@Injectable()
export class GetRecommendedProfessionalsHandler implements IQueryHandler<GetRecommendedProfessionalsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: GetRecommendedProfessionalsQuery,
  ): Promise<DiscoveryPage> {
    const orderBy =
      query.lat !== undefined
        ? `distance_km ASC NULLS LAST, p.rating DESC`
        : `p.rating DESC, p."reviewCount" DESC`;
    return runGeoDiscovery(this.prisma, query, '', orderBy);
  }
}

@QueryHandler(GetNewProfessionalsQuery)
@Injectable()
export class GetNewProfessionalsHandler implements IQueryHandler<GetNewProfessionalsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetNewProfessionalsQuery): Promise<DiscoveryPage> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    return runGeoDiscovery(
      this.prisma,
      query,
      `AND p."createdAt" >= '${thirtyDaysAgo}'`,
      `p."createdAt" DESC`,
    );
  }
}

@QueryHandler(GetTrendingProfessionalsQuery)
@Injectable()
export class GetTrendingProfessionalsHandler implements IQueryHandler<GetTrendingProfessionalsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetTrendingProfessionalsQuery): Promise<DiscoveryPage> {
    return runGeoDiscovery(
      this.prisma,
      query,
      '',
      `p."bookingCount" DESC, p.rating DESC`,
    );
  }
}

// ─── Available Slots ──────────────────────────────────────────────────────────

const SLOT_STEP_MIN = 15;

@QueryHandler(GetAvailableSlotsQuery)
@Injectable()
export class GetAvailableSlotsHandler implements IQueryHandler<GetAvailableSlotsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetAvailableSlotsQuery) {
    const [professional, services] = await Promise.all([
      this.prisma.professional.findFirst({
        where: { id: query.professionalId, deletedAt: null },
        select: {
          id: true,
          travelBufferMin: true,
          isAcceptingBookings: true,
          bookingsPausedUntil: true,
        },
      }),
      this.prisma.serviceOffering.findMany({
        where: {
          id: { in: query.serviceIds },
          professionalId: query.professionalId,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, durationMin: true },
      }),
    ]);

    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    if (services.length !== query.serviceIds.length) {
      throw new BadRequestException(
        'Un ou plusieurs services sont introuvables pour ce professionnel',
      );
    }

    const totalDurationMin = services.reduce(
      (sum, s) => sum + s.durationMin,
      0,
    );

    const date = new Date(query.date + 'T00:00:00.000Z');
    const dayOfWeek = date.getUTCDay();

    const availability = await this.prisma.availability.findFirst({
      where: {
        professionalId: query.professionalId,
        dayOfWeek,
        isActive: true,
        deletedAt: null,
        status: 'OPEN',
      },
    });

    if (!availability) {
      return {
        date: query.date,
        totalDurationMin,
        available: false,
        slots: [],
      };
    }

    const toMin = (time: string): number => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const workStartMin = toMin(availability.startTime);
    const workEndMin = toMin(availability.endTime);
    const breakStartMin = availability.breakStartTime
      ? toMin(availability.breakStartTime)
      : null;
    const breakEndMin = availability.breakEndTime
      ? toMin(availability.breakEndTime)
      : null;

    const dayStart = new Date(query.date + 'T00:00:00.000Z');
    const dayEnd = new Date(query.date + 'T23:59:59.999Z');

    const confirmedBookings = await this.prisma.booking.findMany({
      where: {
        professionalId: query.professionalId,
        deletedAt: null,
        status: BookingStatus.CONFIRMED,
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      select: { scheduledAt: true, durationMin: true },
    });

    const travelBufferMin = professional.travelBufferMin;

    const toTimeStr = (min: number): string =>
      `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

    const slots: Array<{
      startTime: string;
      endTime: string;
      scheduledAt: string;
      confirmedBookingsCount: number;
    }> = [];

    for (
      let startMin = workStartMin;
      startMin + totalDurationMin <= workEndMin;
      startMin += SLOT_STEP_MIN
    ) {
      const endMin = startMin + totalDurationMin;

      if (breakStartMin !== null && breakEndMin !== null) {
        if (startMin < breakEndMin && endMin > breakStartMin) continue;
      }

      let confirmedBookingsCount = 0;
      for (const booking of confirmedBookings) {
        const bookedStartMin =
          booking.scheduledAt.getUTCHours() * 60 +
          booking.scheduledAt.getUTCMinutes();
        const bookedEndMin =
          bookedStartMin + booking.durationMin + travelBufferMin;
        if (startMin < bookedEndMin && bookedStartMin < endMin) {
          confirmedBookingsCount++;
        }
      }

      slots.push({
        startTime: toTimeStr(startMin),
        endTime: toTimeStr(endMin),
        scheduledAt: new Date(
          query.date + 'T' + toTimeStr(startMin) + ':00.000Z',
        ).toISOString(),
        confirmedBookingsCount,
      });
    }

    return {
      date: query.date,
      totalDurationMin,
      travelBufferMin,
      available: true,
      slots,
    };
  }
}

// ─── Pro Calendar ─────────────────────────────────────────────────────────────

const CALENDAR_MAX_DAYS = 31;

@QueryHandler(GetProfessionalBookingsCalendarQuery)
@Injectable()
export class GetProfessionalBookingsCalendarHandler implements IQueryHandler<GetProfessionalBookingsCalendarQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetProfessionalBookingsCalendarQuery) {
    const from = new Date(query.from + 'T00:00:00.000Z');
    const to = new Date(query.to + 'T23:59:59.999Z');

    const diffDays = Math.ceil(
      (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diffDays > CALENDAR_MAX_DAYS) {
      throw new BadRequestException(
        `La plage ne peut pas dépasser ${CALENDAR_MAX_DAYS} jours`,
      );
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        professionalId: query.professionalId,
        deletedAt: null,
        scheduledAt: { gte: from, lte: to },
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED],
        },
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        bookingServices: {
          include: {
            service: { select: { id: true, name: true } },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const grouped = new Map<string, typeof bookings>();
    for (const booking of bookings) {
      const dateKey = booking.scheduledAt.toISOString().split('T')[0];
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey)!.push(booking);
    }

    const days = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayBookings]) => ({
        date,
        count: dayBookings.length,
        bookings: dayBookings.map((b) => ({
          id: b.id,
          scheduledAt: b.scheduledAt,
          durationMin: b.durationMin,
          status: b.status,
          client: {
            id: b.client.id,
            firstName: b.client.firstName,
            lastName: b.client.lastName,
          },
          services: b.bookingServices.map((bs) => ({
            id: bs.service.id,
            name: bs.service.name,
          })),
        })),
      }));

    return { from: query.from, to: query.to, days };
  }
}

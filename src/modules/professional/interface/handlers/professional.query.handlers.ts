import { Inject, Injectable } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '../../../../libs/exceptions/domain.exceptions';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  BookingStatus,
  Prisma,
  ReviewerType,
  ServiceCategoryRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../libs/database/prisma.service';
import {
  MEDIA_STORAGE_SERVICE,
  type MediaStoragePort,
} from '../../../media/media-storage.port';
import { ProfessionalRepository } from '../../infrastructure/persistence/professional.repository';
import {
  presentService,
  presentServices,
} from '../presenters/service.presenter';
import {
  buildSchedule,
  computeOpenNow,
  daySlotsFromAvailabilities,
} from '../presenters/schedule.presenter';
import {
  GetAvailableSlotsQuery,
  GetMyOnboardingStateQuery,
  GetMyProfessionalProfileQuery,
  GetProfessionalDashboardQuery,
  GetNewProfessionalsQuery,
  GetProfessionalAvailabilityQuery,
  GetProfessionalBookingsCalendarQuery,
  GetProfessionalBookingsQuery,
  GetProfessionalGalleryQuery,
  GetProfessionalProfileQuery,
  GetProfessionalRevenueSummaryQuery,
  GetProfessionalServicesQuery,
  GetServiceDetailsQuery,
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
  isOpen: boolean;
  closingTime: string | null;
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
        availabilities: {
          where: { deletedAt: null, isActive: true, status: 'OPEN' },
          select: {
            dayOfWeek: true,
            status: true,
            startTime: true,
            endTime: true,
            breakStartTime: true,
            breakEndTime: true,
          },
        },
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
        ...computeOpenNow(p.availabilities),
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

@QueryHandler(GetMyOnboardingStateQuery)
@Injectable()
export class GetMyOnboardingStateHandler implements IQueryHandler<GetMyOnboardingStateQuery> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(query: GetMyOnboardingStateQuery) {
    const professional = await this.repository.findByUserId(query.userId);
    if (!professional) {
      throw new NotFoundException('Profil professionnel non trouvé');
    }

    const services = professional.getActiveServices();
    const availabilities = professional.getActiveAvailabilities();
    const gallery = professional.getAllGalleryItems();

    return {
      professionalId: professional.id,
      profile: {
        agencyName: professional.agencyName,
        bio: professional.bio ?? null,
        avatarUrl: professional.avatarUrl ?? null,
        location: professional.location,
        address: professional.address ?? null,
        latitude: professional.latitude ?? null,
        longitude: professional.longitude ?? null,
        mainCategories: professional.mainCategories,
        amenities: professional.amenities,
        profileImageUrls: professional.profileImageUrls,
      },
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? null,
        durationMin: s.durationMin,
        basePrice: s.basePrice,
        category: s.category,
        imageUrl: s.imageUrl ?? null,
        isActive: s.isActive,
      })),
      availabilities: availabilities.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.workingHours.startTime,
        endTime: a.workingHours.endTime,
        breakStartTime: a.breakTime?.startTime ?? null,
        breakEndTime: a.breakTime?.endTime ?? null,
        isActive: a.isActive,
        status: a.status,
      })),
      gallery: gallery.map((g) => ({
        id: g.id,
        imageUrl: g.imageUrl,
        caption: g.caption ?? null,
        category: g.category ?? null,
        order: g.order,
        isPublic: g.isPublic,
      })),
      stats: {
        serviceCount: services.length,
        availabilityCount: availabilities.length,
        galleryCount: gallery.length,
      },
    };
  }
}

/** Number of latest reviews embedded in the all-in-one profile payload. */
const PROFILE_REVIEWS_PREVIEW_LIMIT = 5;

/** Privacy-preserving display name, e.g. "Awa D." */
function maskReviewerName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName ? `${lastName.charAt(0)}.` : ''}`.trim();
}

@QueryHandler(GetProfessionalProfileQuery)
@Injectable()
export class GetProfessionalProfileHandler implements IQueryHandler<GetProfessionalProfileQuery> {
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE_SERVICE)
    private readonly media: MediaStoragePort,
  ) {}

  /**
   * Latest client reviews + summary, embedded so the mobile detail screen can
   * render the "Avis" tab from a single profile request. The full, paginated
   * list stays available at GET /reviews/professionals/:id.
   */
  private async getReviewsPreview(professionalId: string) {
    const reviews = await this.prisma.review.findMany({
      where: {
        professionalId,
        reviewerType: ReviewerType.CLIENT,
        isVisible: true,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: PROFILE_REVIEWS_PREVIEW_LIMIT,
      select: {
        id: true,
        rating: true,
        comment: true,
        isEdited: true,
        createdAt: true,
        reviewerId: true,
      },
    });

    const reviewerIds = [...new Set(reviews.map((r) => r.reviewerId))];
    const users = reviewerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return reviews.map((r) => {
      const user = userMap.get(r.reviewerId);
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        isEdited: r.isEdited,
        createdAt: r.createdAt,
        reviewerName: user
          ? maskReviewerName(user.firstName, user.lastName)
          : 'Anonyme',
      };
    });
  }

  async execute(query: GetProfessionalProfileQuery) {
    const professional = await this.repository.findById(query.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    const availabilities = professional.getActiveAvailabilities();
    const slots = daySlotsFromAvailabilities(availabilities);
    const reviewsPreview = await this.getReviewsPreview(professional.id);

    return {
      ...professional.getSummary(),
      ...computeOpenNow(slots),
      bio: professional.bio,
      avatarUrl: professional.avatarUrl,
      location: professional.location,
      address: professional.address,
      // `categories` mirrors `mainCategories` for client-side clarity.
      categories: professional.mainCategories,
      services: presentServices(this.media, professional.getActiveServices()),
      availability: availabilities,
      schedule: buildSchedule(slots),
      gallery: professional.getPublicGallery(),
      reviewsPreview,
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
      data: data.map((p) => ({
        ...p.getSummary(),
        ...computeOpenNow(
          daySlotsFromAvailabilities(p.getActiveAvailabilities()),
        ),
      })),
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
  constructor(
    private readonly repository: ProfessionalRepository,
    @Inject(MEDIA_STORAGE_SERVICE)
    private readonly media: MediaStoragePort,
  ) {}

  async execute(query: GetProfessionalServicesQuery) {
    const exists = await this.repository.professionalExists(
      query.professionalId,
    );
    if (!exists) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    const services = await this.repository.findServicesByProfessional(
      query.professionalId,
      query.includeInactive,
    );
    const presented = presentServices(this.media, services);

    return {
      professionalId: query.professionalId,
      services: presented,
      count: presented.length,
    };
  }
}

@QueryHandler(GetServiceDetailsQuery)
@Injectable()
export class GetServiceDetailsHandler implements IQueryHandler<GetServiceDetailsQuery> {
  constructor(
    private readonly repository: ProfessionalRepository,
    @Inject(MEDIA_STORAGE_SERVICE)
    private readonly media: MediaStoragePort,
  ) {}

  async execute(query: GetServiceDetailsQuery) {
    const service = await this.repository.findServiceById(query.serviceId);
    if (!service || service.professionalId !== query.professionalId) {
      throw new NotFoundException('Service non trouvé');
    }

    return {
      professionalId: query.professionalId,
      service: presentService(this.media, service),
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
      data: data.map((p) => ({
        ...p.getSummary(),
        ...computeOpenNow(
          daySlotsFromAvailabilities(p.getActiveAvailabilities()),
        ),
      })),
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

@QueryHandler(GetProfessionalDashboardQuery)
@Injectable()
export class GetProfessionalDashboardHandler implements IQueryHandler<GetProfessionalDashboardQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: ProfessionalRepository,
  ) {}

  async execute(query: GetProfessionalDashboardQuery) {
    const professional = await this.repository.findByUserId(query.userId);
    if (!professional) {
      throw new NotFoundException('Profil professionnel non trouvé');
    }

    const professionalId = professional.id;
    const now = new Date();

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );
    previousMonthStart.setHours(0, 0, 0, 0);

    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    previousMonthEnd.setHours(23, 59, 59, 999);

    const bookingSelect = {
      id: true,
      scheduledAt: true,
      service: { select: { name: true } },
      client: { select: { firstName: true, lastName: true } },
    } as const;

    const [
      pendingCount,
      latestPending,
      nextConfirmed,
      remainingTodayCount,
      currentMonthAggregate,
      previousMonthAggregate,
      ratingAggregate,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: {
          professionalId,
          status: BookingStatus.PENDING,
          deletedAt: null,
        },
      }),
      this.prisma.booking.findFirst({
        where: {
          professionalId,
          status: BookingStatus.PENDING,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: bookingSelect,
      }),
      this.prisma.booking.findFirst({
        where: {
          professionalId,
          status: BookingStatus.CONFIRMED,
          deletedAt: null,
          scheduledAt: { gte: now },
        },
        orderBy: { scheduledAt: 'asc' },
        select: bookingSelect,
      }),
      this.prisma.booking.count({
        where: {
          professionalId,
          status: BookingStatus.CONFIRMED,
          deletedAt: null,
          scheduledAt: { gte: now, lte: todayEnd },
        },
      }),
      this.prisma.booking.aggregate({
        where: {
          professionalId,
          status: BookingStatus.COMPLETED,
          deletedAt: null,
          updatedAt: { gte: currentMonthStart, lte: now },
        },
        _sum: { totalPrice: true },
      }),
      this.prisma.booking.aggregate({
        where: {
          professionalId,
          status: BookingStatus.COMPLETED,
          deletedAt: null,
          updatedAt: { gte: previousMonthStart, lte: previousMonthEnd },
        },
        _sum: { totalPrice: true },
      }),
      this.prisma.review.aggregate({
        where: {
          professionalId,
          reviewerType: ReviewerType.CLIENT,
          isVisible: true,
          deletedAt: null,
        },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    const currentMonthFcfa = toMoney(currentMonthAggregate._sum.totalPrice);
    const previousMonthFcfa = toMoney(previousMonthAggregate._sum.totalPrice);
    const rawGrowth = toPercentageChange(currentMonthFcfa, previousMonthFcfa);
    const growthPercent = rawGrowth ?? 0.0;

    const mapBooking = (b: typeof latestPending) =>
      b
        ? {
            id: b.id,
            serviceName: b.service.name,
            clientFirstName: b.client.firstName,
            clientLastName: b.client.lastName,
            clientAvatarUrl: null,
            scheduledAt: b.scheduledAt.toISOString(),
          }
        : null;

    return {
      data: {
        pendingRequests: {
          count: pendingCount,
          latest: mapBooking(latestPending),
        },
        agenda: {
          nextAppointment: mapBooking(nextConfirmed),
          remainingTodayCount,
        },
        revenue: {
          currentMonthFcfa,
          previousMonthFcfa,
          growthPercent,
        },
        rating: {
          average: Math.round((ratingAggregate._avg.rating ?? 0) * 10) / 10,
          max: 5,
          totalReviews: ratingAggregate._count.id,
        },
      },
    };
  }
}

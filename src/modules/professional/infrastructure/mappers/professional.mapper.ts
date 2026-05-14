import {
  AvailabilityEntity,
  TimeRangeVO,
} from '../../core/entities/availability.entity';
import { GalleryItemEntity } from '../../core/entities/gallery-item.entity';
import { ProfessionalEntity } from '../../core/entities/professional.entity';
import {
  CommuneFeeVO,
  ServiceOfferingEntity,
} from '../../core/entities/service-offering.entity';
import {
  AvailabilityStatus,
  ProfessionalStatus,
  ServiceLocation,
} from '../../core/enums';

type RawCommuneFee = {
  commune: string;
  travelFee: number;
  isAvailable: boolean;
};

type RawServiceOffering = {
  id: string;
  professionalId: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
  };
  name: string;
  description: string | null;
  imageUrl: string | null;
  durationMin: number;
  basePrice: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  communeFees?: RawCommuneFee[];
};

type RawAvailability = {
  id: string;
  professionalId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStartTime: string | null;
  breakEndTime: string | null;
  status: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type RawGalleryItem = {
  id: string;
  professionalId: string;
  imageUrl: string;
  caption: string | null;
  category: string | null;
  order: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type RawProfessional = {
  id: string;
  userId: string;
  agencyName: string;
  bio: string | null;
  avatarUrl: string | null;
  location: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  isVerified: boolean;
  rejectionReason: string | null;
  isListingActive: boolean;
  isAcceptingBookings: boolean;
  bookingsPausedUntil: Date | null;
  rating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  services?: RawServiceOffering[];
  availabilities?: RawAvailability[];
  gallery?: RawGalleryItem[];
};

/**
 * ProfessionalMapper
 * Maps between Prisma Professional model and domain ProfessionalEntity
 */
export class ProfessionalMapper {
  /**
   * Convert Prisma model to domain entity
   */
  static toDomain(raw: RawProfessional): ProfessionalEntity {
    return new ProfessionalEntity({
      id: raw.id,
      userId: raw.userId,
      agencyName: raw.agencyName,
      bio: raw.bio ?? undefined,
      avatarUrl: raw.avatarUrl ?? undefined,
      location: (raw.location as ServiceLocation) || ServiceLocation.BOTH,
      address: raw.address ?? undefined,
      latitude: raw.latitude ?? undefined,
      longitude: raw.longitude ?? undefined,
      status: (raw.status as ProfessionalStatus) || ProfessionalStatus.PENDING,
      isVerified: raw.isVerified,
      rejectionReason: raw.rejectionReason ?? undefined,
      isListingActive: raw.isListingActive,
      isAcceptingBookings: raw.isAcceptingBookings,
      bookingsPausedUntil: raw.bookingsPausedUntil ?? undefined,
      rating: raw.rating,
      reviewCount: raw.reviewCount,
      services:
        raw.services?.map((s) => ServiceOfferingMapper.toDomain(s)) || [],
      availabilities:
        raw.availabilities?.map((a) => AvailabilityMapper.toDomain(a)) || [],
      gallery: raw.gallery?.map((g) => GalleryItemMapper.toDomain(g)) || [],
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt ?? undefined,
    });
  }

  /**
   * Convert domain entity to Prisma-compatible object
   */
  static toPersistence(entity: ProfessionalEntity) {
    return {
      id: entity.id,
      userId: entity.userId,
      agencyName: entity.agencyName,
      bio: entity.bio,
      avatarUrl: entity.avatarUrl,
      location: entity.location,
      address: entity.address,
      latitude: entity.latitude,
      longitude: entity.longitude,
      status: entity.status,
      isVerified: entity.isVerified,
      rejectionReason: entity.rejectionReason ?? null,
      isListingActive: entity.isListingActive,
      isAcceptingBookings: entity.isAcceptingBookings,
      bookingsPausedUntil: entity.bookingsPausedUntil ?? null,
      rating: entity.rating,
      reviewCount: entity.reviewCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      metadata: {},
    };
  }
}

/**
 * ServiceOfferingMapper
 * Maps between Prisma ServiceOffering model and domain ServiceOfferingEntity
 */
export class ServiceOfferingMapper {
  static toDomain(raw: RawServiceOffering): ServiceOfferingEntity {
    const communeFees =
      raw.communeFees?.map(
        (cf) => new CommuneFeeVO(cf.commune, cf.travelFee, cf.isAvailable),
      ) || [];

    return new ServiceOfferingEntity({
      id: raw.id,
      professionalId: raw.professionalId,
      name: raw.name,
      description: raw.description ?? undefined,
      imageUrl: raw.imageUrl ?? undefined,
      durationMin: raw.durationMin,
      basePrice: raw.basePrice,
      category: raw.category.name,
      isActive: raw.isActive,
      communeFees,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt ?? undefined,
    });
  }

  static toPersistence(entity: ServiceOfferingEntity) {
    return {
      id: entity.id,
      professionalId: entity.professionalId,
      name: entity.name,
      description: entity.description,
      imageUrl: entity.imageUrl ?? null,
      durationMin: entity.durationMin,
      basePrice: entity.basePrice,
      category: {
        connect: {
          name: entity.category,
        },
      },
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      metadata: {},
    };
  }
}

/**
 * AvailabilityMapper
 * Maps between Prisma Availability model and domain AvailabilityEntity
 */
export class AvailabilityMapper {
  static toDomain(raw: RawAvailability): AvailabilityEntity {
    const workingHours = TimeRangeVO.create(raw.startTime, raw.endTime);
    let breakTime: TimeRangeVO | undefined;

    if (raw.breakStartTime && raw.breakEndTime) {
      breakTime = TimeRangeVO.create(raw.breakStartTime, raw.breakEndTime);
    }

    return new AvailabilityEntity({
      id: raw.id,
      professionalId: raw.professionalId,
      dayOfWeek: raw.dayOfWeek,
      workingHours,
      breakTime,
      status: (raw.status as AvailabilityStatus) || AvailabilityStatus.OPEN,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt ?? undefined,
    });
  }

  static toPersistence(entity: AvailabilityEntity) {
    return {
      id: entity.id,
      professionalId: entity.professionalId,
      dayOfWeek: entity.dayOfWeek,
      startTime: entity.workingHours.startTime,
      endTime: entity.workingHours.endTime,
      breakStartTime: entity.breakTime?.startTime,
      breakEndTime: entity.breakTime?.endTime,
      status: entity.status,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      metadata: {},
    };
  }
}

/**
 * GalleryItemMapper
 * Maps between Prisma GalleryItem model and domain GalleryItemEntity
 */
export class GalleryItemMapper {
  static toDomain(raw: RawGalleryItem): GalleryItemEntity {
    return new GalleryItemEntity({
      id: raw.id,
      professionalId: raw.professionalId,
      imageUrl: raw.imageUrl,
      caption: raw.caption ?? undefined,
      category: raw.category ?? undefined,
      order: raw.order,
      isPublic: raw.isPublic,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt ?? undefined,
    });
  }

  static toPersistence(entity: GalleryItemEntity) {
    return {
      id: entity.id,
      professionalId: entity.professionalId,
      imageUrl: entity.imageUrl,
      caption: entity.caption,
      category: entity.category,
      order: entity.order,
      isPublic: entity.isPublic,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      metadata: {},
    };
  }
}

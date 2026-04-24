import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommandHandler,
  EventBus,
  ICommandHandler,
  IQueryHandler,
  QueryHandler,
} from '@nestjs/cqrs';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../../libs/database/prisma.service';
import {
  CreateClientBookingCommand,
  RequestBookingCancellationCommand,
  UpdatePendingBookingCommand,
} from '../commands';
import {
  BookingCancellationRequestedEvent,
  BookingCreatedEvent,
} from '../events/booking.events';
import { GetMyBookingByIdQuery, GetMyBookingsQuery } from '../queries';

const BOOKING_CANCELLATION_REQUEST_STATUS_NONE = 'NONE' as const;
const BOOKING_CANCELLATION_REQUEST_STATUS_PENDING = 'PENDING' as const;

@CommandHandler(CreateClientBookingCommand)
@Injectable()
export class CreateClientBookingHandler implements ICommandHandler<CreateClientBookingCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateClientBookingCommand) {
    const service = await this.prisma.serviceOffering.findFirst({
      where: {
        id: command.serviceId,
        professionalId: command.professionalId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        professional: {
          select: {
            id: true,
            isVerified: true,
            status: true,
            deletedAt: true,
          },
        },
        communeFees: {
          where: {
            deletedAt: null,
            isAvailable: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service non trouve pour ce professionnel');
    }

    if (
      !service.professional.isVerified ||
      service.professional.status !== 'ACTIVE' ||
      service.professional.deletedAt
    ) {
      throw new BadRequestException(
        'Le professionnel ne peut pas accepter de reservations pour le moment',
      );
    }

    const scheduledAt = new Date(command.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Date de reservation invalide');
    }

    const travelFee =
      service.communeFees.find((fee) => fee.commune === command.commune)
        ?.travelFee ?? 0;

    const overlaps = await findOverlappingBookings(this.prisma, {
      professionalId: command.professionalId,
      scheduledAt,
      durationMin: service.durationMin,
    });

    const booking = await this.prisma.booking.create({
      data: {
        clientId: command.clientId,
        professionalId: command.professionalId,
        serviceId: command.serviceId,
        scheduledAt,
        durationMin: service.durationMin,
        travelFee,
        totalPrice: service.basePrice + travelFee,
        commune: command.commune,
        address: command.address,
        clientNotes: command.clientNotes,
        status: BookingStatus.PENDING,
        cancellationRequestStatus: BOOKING_CANCELLATION_REQUEST_STATUS_NONE,
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            durationMin: true,
            basePrice: true,
          },
        },
        professional: {
          select: {
            id: true,
            agencyName: true,
          },
        },
      },
    });

    this.eventBus.publish(new BookingCreatedEvent(booking.id));

    return {
      data: booking,
      bookingWarnings: {
        hasScheduleConflict: overlaps.length > 0,
        overlappingBookingIds: overlaps.map((item) => item.id),
      },
    };
  }
}

@CommandHandler(UpdatePendingBookingCommand)
@Injectable()
export class UpdatePendingBookingHandler implements ICommandHandler<UpdatePendingBookingCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdatePendingBookingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: command.bookingId,
        clientId: command.clientId,
        deletedAt: null,
      },
      include: {
        service: {
          include: {
            communeFees: {
              where: {
                deletedAt: null,
                isAvailable: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Reservation non trouvee');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        'Seules les reservations en attente peuvent etre modifiees',
      );
    }

    const nextScheduledAt = command.scheduledAt
      ? new Date(command.scheduledAt)
      : booking.scheduledAt;

    if (Number.isNaN(nextScheduledAt.getTime())) {
      throw new BadRequestException('Date de reservation invalide');
    }

    const nextCommune = command.commune ?? booking.commune;
    const travelFee =
      booking.service.communeFees.find((fee) => fee.commune === nextCommune)
        ?.travelFee ?? 0;

    const overlaps = await findOverlappingBookings(this.prisma, {
      professionalId: booking.professionalId,
      scheduledAt: nextScheduledAt,
      durationMin: booking.durationMin,
      excludeBookingId: booking.id,
    });

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        scheduledAt: nextScheduledAt,
        commune: nextCommune,
        address: command.address ?? booking.address,
        clientNotes: command.clientNotes ?? booking.clientNotes,
        travelFee,
        totalPrice: booking.service.basePrice + travelFee,
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            durationMin: true,
            basePrice: true,
          },
        },
        professional: {
          select: {
            id: true,
            agencyName: true,
          },
        },
      },
    });

    return {
      data: updated,
      bookingWarnings: {
        hasScheduleConflict: overlaps.length > 0,
        overlappingBookingIds: overlaps.map((item) => item.id),
      },
    };
  }
}

@CommandHandler(RequestBookingCancellationCommand)
@Injectable()
export class RequestBookingCancellationHandler implements ICommandHandler<RequestBookingCancellationCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RequestBookingCancellationCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: command.bookingId,
        clientId: command.clientId,
        deletedAt: null,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reservation non trouvee');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        "Une demande d'annulation est possible uniquement pour une reservation confirmee",
      );
    }

    if (
      booking.cancellationRequestStatus ===
      BOOKING_CANCELLATION_REQUEST_STATUS_PENDING
    ) {
      throw new BadRequestException(
        "Une demande d'annulation est deja en cours",
      );
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        cancellationRequestStatus: BOOKING_CANCELLATION_REQUEST_STATUS_PENDING,
        cancellationRequestedAt: new Date(),
        cancellationReviewedAt: null,
        cancellationRequestReason: command.reason,
      },
    });

    this.eventBus.publish(
      new BookingCancellationRequestedEvent(updatedBooking.id),
    );

    return updatedBooking;
  }
}

@QueryHandler(GetMyBookingsQuery)
@Injectable()
export class GetMyBookingsHandler implements IQueryHandler<GetMyBookingsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMyBookingsQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const whereStatus = toBookingStatus(query.status);

    const where = {
      clientId: query.clientId,
      deletedAt: null,
      ...(whereStatus ? { status: whereStatus } : {}),
    };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          professional: {
            select: {
              id: true,
              agencyName: true,
              avatarUrl: true,
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
        orderBy: {
          scheduledAt: 'desc',
        },
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

@QueryHandler(GetMyBookingByIdQuery)
@Injectable()
export class GetMyBookingByIdHandler implements IQueryHandler<GetMyBookingByIdQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMyBookingByIdQuery) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: query.bookingId,
        clientId: query.clientId,
        deletedAt: null,
      },
      include: {
        professional: {
          select: {
            id: true,
            agencyName: true,
            avatarUrl: true,
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
    });

    if (!booking) {
      throw new NotFoundException('Reservation non trouvee');
    }

    return booking;
  }
}

function toBookingStatus(status?: string): BookingStatus | undefined {
  if (!status) {
    return undefined;
  }

  const normalized = status.toUpperCase();

  if (!(normalized in BookingStatus)) {
    throw new BadRequestException('Statut de reservation invalide');
  }

  return BookingStatus[normalized as keyof typeof BookingStatus];
}

async function findOverlappingBookings(
  prisma: PrismaService,
  args: {
    professionalId: string;
    scheduledAt: Date;
    durationMin: number;
    excludeBookingId?: string;
  },
): Promise<Array<{ id: string }>> {
  const start = args.scheduledAt;
  const end = new Date(start.getTime() + args.durationMin * 60000);

  const marginBefore = new Date(start.getTime() - 24 * 60 * 60000);
  const marginAfter = new Date(end.getTime() + 24 * 60 * 60000);

  const candidates = await prisma.booking.findMany({
    where: {
      professionalId: args.professionalId,
      deletedAt: null,
      status: {
        in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      },
      ...(args.excludeBookingId ? { id: { not: args.excludeBookingId } } : {}),
      scheduledAt: {
        gte: marginBefore,
        lte: marginAfter,
      },
    },
    select: {
      id: true,
      scheduledAt: true,
      durationMin: true,
    },
  });

  return candidates
    .filter((item) => {
      const itemStart = item.scheduledAt;
      const itemEnd = new Date(itemStart.getTime() + item.durationMin * 60000);
      return start < itemEnd && itemStart < end;
    })
    .map((item) => ({ id: item.id }));
}

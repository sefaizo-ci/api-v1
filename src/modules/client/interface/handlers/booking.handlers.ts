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
    const [services, professional] = await Promise.all([
      this.prisma.serviceOffering.findMany({
        where: {
          id: { in: command.serviceIds },
          professionalId: command.professionalId,
          isActive: true,
          deletedAt: null,
        },
        include: {
          communeFees: {
            where: { deletedAt: null, isAvailable: true },
          },
        },
      }),
      this.prisma.professional.findFirst({
        where: { id: command.professionalId, deletedAt: null },
        select: {
          id: true,
          isVerified: true,
          status: true,
          isAcceptingBookings: true,
          bookingsPausedUntil: true,
          travelBufferMin: true,
        },
      }),
    ]);

    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    if (services.length !== command.serviceIds.length) {
      throw new NotFoundException(
        'Un ou plusieurs services sont introuvables pour ce professionnel',
      );
    }

    if (!professional.isVerified || professional.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Le professionnel ne peut pas accepter de réservations pour le moment',
      );
    }

    if (!professional.isAcceptingBookings) {
      throw new BadRequestException(
        'Le professionnel ne prend pas de réservations en ce moment',
      );
    }

    if (
      professional.bookingsPausedUntil &&
      professional.bookingsPausedUntil > new Date()
    ) {
      throw new BadRequestException(
        `Les réservations reprennent le ${professional.bookingsPausedUntil.toLocaleDateString('fr-FR')}`,
      );
    }

    const scheduledAt = new Date(command.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Date de réservation invalide');
    }

    const totalDurationMin = services.reduce((sum, s) => sum + s.durationMin, 0);
    const totalBasePrice = services.reduce((sum, s) => sum + s.basePrice, 0);

    await validateBookingSlot(this.prisma, {
      professionalId: command.professionalId,
      scheduledAt,
      durationMin: totalDurationMin,
    });

    const primaryServiceId = command.serviceIds[0];
    const primaryService = services.find((s) => s.id === primaryServiceId) ?? services[0];

    let travelFee = 0;
    if (primaryService.communeFees.length > 0) {
      const fee = primaryService.communeFees.find(
        (f) => f.commune === command.commune,
      );
      if (!fee) {
        throw new BadRequestException(
          `Ce professionnel n'est pas disponible dans la commune "${command.commune}".`,
        );
      }
      travelFee = fee.travelFee;
    }

    const overlaps = await findOverlappingBookings(this.prisma, {
      professionalId: command.professionalId,
      scheduledAt,
      durationMin: totalDurationMin,
      travelBufferMin: professional.travelBufferMin,
    });

    const booking = await this.prisma.booking.create({
      data: {
        clientId: command.clientId,
        professionalId: command.professionalId,
        serviceId: primaryServiceId,
        scheduledAt,
        durationMin: totalDurationMin,
        travelFee,
        totalPrice: totalBasePrice + travelFee,
        commune: command.commune,
        address: command.address,
        clientNotes: command.clientNotes,
        status: BookingStatus.PENDING,
        cancellationRequestStatus: BOOKING_CANCELLATION_REQUEST_STATUS_NONE,
        bookingServices: {
          create: command.serviceIds.map((id, index) => {
            const service = services.find((s) => s.id === id)!;
            return {
              serviceId: id,
              durationMin: service.durationMin,
              basePrice: service.basePrice,
              order: index,
            };
          }),
        },
      },
      include: {
        service: {
          select: { id: true, name: true, durationMin: true, basePrice: true },
        },
        bookingServices: {
          include: {
            service: {
              select: { id: true, name: true, durationMin: true, basePrice: true },
            },
          },
          orderBy: { order: 'asc' },
        },
        professional: { select: { id: true, agencyName: true } },
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
            select: { id: true, agencyName: true, avatarUrl: true },
          },
          service: {
            select: { id: true, name: true, durationMin: true, basePrice: true },
          },
          bookingServices: {
            include: {
              service: {
                select: { id: true, name: true, durationMin: true, basePrice: true },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { scheduledAt: 'desc' },
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
          select: { id: true, agencyName: true, avatarUrl: true },
        },
        service: {
          select: { id: true, name: true, durationMin: true, basePrice: true },
        },
        bookingServices: {
          include: {
            service: {
              select: { id: true, name: true, durationMin: true, basePrice: true },
            },
          },
          orderBy: { order: 'asc' },
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
  if (!status) return undefined;
  const normalized = status.toUpperCase();
  if (!(normalized in BookingStatus)) {
    throw new BadRequestException('Statut de reservation invalide');
  }
  return BookingStatus[normalized as keyof typeof BookingStatus];
}

async function validateBookingSlot(
  prisma: PrismaService,
  args: { professionalId: string; scheduledAt: Date; durationMin: number },
): Promise<void> {
  const dayOfWeek = args.scheduledAt.getUTCDay();

  const availability = await prisma.availability.findFirst({
    where: {
      professionalId: args.professionalId,
      dayOfWeek,
      isActive: true,
      deletedAt: null,
      status: 'OPEN',
    },
  });

  if (!availability) {
    throw new BadRequestException(
      "Le professionnel n'est pas disponible ce jour-là.",
    );
  }

  const toMin = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const bookingStartMin =
    args.scheduledAt.getUTCHours() * 60 + args.scheduledAt.getUTCMinutes();
  const bookingEndMin = bookingStartMin + args.durationMin;
  const workStartMin = toMin(availability.startTime);
  const workEndMin = toMin(availability.endTime);

  if (bookingStartMin < workStartMin || bookingEndMin > workEndMin) {
    throw new BadRequestException(
      `Le créneau est hors des heures de travail (${availability.startTime} – ${availability.endTime}).`,
    );
  }

  if (availability.breakStartTime && availability.breakEndTime) {
    const breakStartMin = toMin(availability.breakStartTime);
    const breakEndMin = toMin(availability.breakEndTime);
    if (bookingStartMin < breakEndMin && bookingEndMin > breakStartMin) {
      throw new BadRequestException(
        `Le créneau chevauche la pause (${availability.breakStartTime} – ${availability.breakEndTime}).`,
      );
    }
  }
}

async function findOverlappingBookings(
  prisma: PrismaService,
  args: {
    professionalId: string;
    scheduledAt: Date;
    durationMin: number;
    travelBufferMin?: number;
    excludeBookingId?: string;
  },
): Promise<Array<{ id: string; scheduledAt: Date; durationMin: number }>> {
  const buffer = args.travelBufferMin ?? 0;
  const start = args.scheduledAt;
  const end = new Date(start.getTime() + args.durationMin * 60000);

  const candidates = await prisma.booking.findMany({
    where: {
      professionalId: args.professionalId,
      deletedAt: null,
      status: BookingStatus.CONFIRMED,
      ...(args.excludeBookingId ? { id: { not: args.excludeBookingId } } : {}),
      scheduledAt: {
        gte: new Date(start.getTime() - (args.durationMin + buffer) * 60000),
        lte: end,
      },
    },
    select: { id: true, scheduledAt: true, durationMin: true },
  });

  return candidates.filter((item) => {
    const itemStart = item.scheduledAt;
    const itemEnd = new Date(
      itemStart.getTime() + (item.durationMin + buffer) * 60000,
    );
    return start < itemEnd && itemStart < end;
  });
}

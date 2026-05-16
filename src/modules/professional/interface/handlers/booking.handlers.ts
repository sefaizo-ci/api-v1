import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../libs/database/prisma.service';
import {
  ApproveBookingCancellationRequestCommand,
  CancelBookingCommand,
  CompleteBookingCommand,
  ConfirmBookingCommand,
  MarkNoShowCommand,
  RejectBookingCancellationRequestCommand,
  RejectBookingCommand,
} from '../../interface/commands/booking.commands';
import {
  BookingCancellationRequestApprovedEvent,
  BookingCancellationRequestRejectedEvent,
  BookingCancelledEvent,
  BookingCompletedEvent,
  BookingConfirmedEvent,
  BookingNoShowEvent,
  BookingRejectedEvent,
} from '../events/booking.events';

@CommandHandler(ConfirmBookingCommand)
@Injectable()
export class ConfirmBookingHandler implements ICommandHandler<ConfirmBookingCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ConfirmBookingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: command.bookingId,
        professionalId: command.professionalId,
        deletedAt: null,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reservation non trouvee');
    }

    if (booking.status !== 'PENDING') {
      throw new BadRequestException(
        'Seules les reservations en attente peuvent etre confirmees',
      );
    }

    const scheduledAt = booking.scheduledAt;
    const end = new Date(scheduledAt.getTime() + booking.durationMin * 60000);

    const overlappingConfirmed = await this.prisma.booking.findMany({
      where: {
        professionalId: command.professionalId,
        id: { not: booking.id },
        status: 'CONFIRMED',
        deletedAt: null,
        scheduledAt: {
          gte: new Date(scheduledAt.getTime() - booking.durationMin * 60000),
          lt: end,
        },
      },
      select: { id: true, scheduledAt: true, durationMin: true },
    });

    const conflicts = overlappingConfirmed.filter((item) => {
      const itemEnd = new Date(
        item.scheduledAt.getTime() + item.durationMin * 60000,
      );
      return item.scheduledAt < end && scheduledAt < itemEnd;
    });

    await Promise.all([
      this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      }),
      this.prisma.professional.update({
        where: { id: command.professionalId },
        data: { bookingCount: { increment: 1 } },
      }),
    ]);

    this.eventBus.publish(new BookingConfirmedEvent(booking.id));

    return {
      confirmed: true,
      warnings: {
        hasScheduleConflict: conflicts.length > 0,
        conflictingBookingIds: conflicts.map((c) => c.id),
      },
    };
  }
}

@CommandHandler(RejectBookingCommand)
@Injectable()
export class RejectBookingHandler implements ICommandHandler<RejectBookingCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RejectBookingCommand): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: command.bookingId,
        professionalId: command.professionalId,
        deletedAt: null,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reservation non trouvee');
    }

    if (booking.status !== 'PENDING') {
      throw new BadRequestException(
        'Seules les reservations en attente peuvent etre refusees',
      );
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'REJECTED',
        cancelledAt: new Date(),
        cancellationNote: command.reason,
      },
    });

    this.eventBus.publish(new BookingRejectedEvent(booking.id));
  }
}

@CommandHandler(CompleteBookingCommand)
@Injectable()
export class CompleteBookingHandler implements ICommandHandler<CompleteBookingCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CompleteBookingCommand): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: command.bookingId,
        professionalId: command.professionalId,
        deletedAt: null,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reservation non trouvee');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Seules les reservations confirmees peuvent etre completees',
      );
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'COMPLETED',
      },
    });

    this.eventBus.publish(new BookingCompletedEvent(booking.id));
  }
}

@CommandHandler(CancelBookingCommand)
@Injectable()
export class CancelBookingHandler implements ICommandHandler<CancelBookingCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CancelBookingCommand): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: command.bookingId,
        deletedAt: null,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reservation non trouvee');
    }

    if (
      booking.clientId !== command.userId &&
      booking.professionalId !== command.userId
    ) {
      throw new BadRequestException(
        'Vous ne pouvez pas annuler cette reservation',
      );
    }

    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new BadRequestException(
        'Cette reservation ne peut plus etre annulee',
      );
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationNote: command.reason,
      },
    });

    this.eventBus.publish(
      new BookingCancelledEvent(booking.id, command.userId),
    );
  }
}

@CommandHandler(ApproveBookingCancellationRequestCommand)
@Injectable()
export class ApproveBookingCancellationRequestHandler implements ICommandHandler<ApproveBookingCancellationRequestCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(
    command: ApproveBookingCancellationRequestCommand,
  ): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: command.bookingId,
        professionalId: command.professionalId,
        deletedAt: null,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reservation non trouvee');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        "Seules les reservations confirmees peuvent recevoir une validation d'annulation",
      );
    }

    if (booking.cancellationRequestStatus !== 'PENDING') {
      throw new BadRequestException(
        "Aucune demande d'annulation en attente pour cette reservation",
      );
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationRequestStatus: 'APPROVED',
        cancellationReviewedAt: new Date(),
      },
    });

    this.eventBus.publish(
      new BookingCancellationRequestApprovedEvent(booking.id),
    );
  }
}

@CommandHandler(RejectBookingCancellationRequestCommand)
@Injectable()
export class RejectBookingCancellationRequestHandler implements ICommandHandler<RejectBookingCancellationRequestCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(
    command: RejectBookingCancellationRequestCommand,
  ): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: command.bookingId,
        professionalId: command.professionalId,
        deletedAt: null,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reservation non trouvee');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        "Seules les reservations confirmees peuvent recevoir un refus d'annulation",
      );
    }

    if (booking.cancellationRequestStatus !== 'PENDING') {
      throw new BadRequestException(
        "Aucune demande d'annulation en attente pour cette reservation",
      );
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        cancellationRequestStatus: 'NONE',
        cancellationReviewedAt: new Date(),
        cancellationNote: command.reason,
      },
    });

    this.eventBus.publish(
      new BookingCancellationRequestRejectedEvent(booking.id),
    );
  }
}

@CommandHandler(MarkNoShowCommand)
@Injectable()
export class MarkNoShowHandler implements ICommandHandler<MarkNoShowCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: MarkNoShowCommand): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: command.bookingId,
        professionalId: command.professionalId,
        deletedAt: null,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reservation non trouvee');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Seules les reservations confirmees peuvent etre marquees comme absence.',
      );
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'NO_SHOW' },
    });

    this.eventBus.publish(new BookingNoShowEvent(booking.id));
  }
}

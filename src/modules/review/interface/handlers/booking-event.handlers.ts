import { Injectable } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { CancellationInitiator } from '@prisma/client';
import { PrismaService } from '../../../../libs/database/prisma.service';
import {
  BookingCancellationRequestApprovedEvent,
  BookingCancelledEvent,
  BookingCompletedEvent,
} from '../../../professional/interface/events/booking.events';
import { REVIEW_WINDOW_HOURS } from './submit-review.handler';

@EventsHandler(BookingCompletedEvent)
@Injectable()
export class BookingCompletedReviewHandler implements IEventHandler<BookingCompletedEvent> {
  constructor(private readonly prisma: PrismaService) {}

  async handle(event: BookingCompletedEvent): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: event.bookingId },
      select: { id: true, status: true },
    });

    if (!booking || booking.status !== 'COMPLETED') return;

    const expiresAt = new Date(
      Date.now() + REVIEW_WINDOW_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.reviewSession.upsert({
      where: { bookingId: event.bookingId },
      create: { bookingId: event.bookingId, expiresAt },
      update: {},
    });
  }
}

@EventsHandler(BookingCancelledEvent)
@Injectable()
export class BookingCancelledReviewHandler implements IEventHandler<BookingCancelledEvent> {
  constructor(private readonly prisma: PrismaService) {}

  async handle(event: BookingCancelledEvent): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: event.bookingId },
      include: { professional: { select: { id: true, userId: true } } },
    });

    if (!booking) return;

    const cancelledByUserId = event.cancelledByUserId;
    if (!cancelledByUserId) return;

    const isProfessional = booking.professional.userId === cancelledByUserId;

    await this.prisma.cancellationEvent.create({
      data: {
        bookingId: booking.id,
        initiatedBy: isProfessional
          ? CancellationInitiator.PROFESSIONAL
          : CancellationInitiator.CLIENT,
        clientId: booking.clientId,
        professionalId: booking.professionalId,
        reason: booking.cancellationNote ?? undefined,
      },
    });
  }
}

@EventsHandler(BookingCancellationRequestApprovedEvent)
@Injectable()
export class BookingCancellationApprovedReviewHandler implements IEventHandler<BookingCancellationRequestApprovedEvent> {
  constructor(private readonly prisma: PrismaService) {}

  async handle(event: BookingCancellationRequestApprovedEvent): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: event.bookingId },
      select: {
        id: true,
        clientId: true,
        professionalId: true,
        cancellationRequestReason: true,
      },
    });

    if (!booking) return;

    await this.prisma.cancellationEvent.create({
      data: {
        bookingId: booking.id,
        initiatedBy: CancellationInitiator.CLIENT,
        clientId: booking.clientId,
        professionalId: booking.professionalId,
        reason: booking.cancellationRequestReason ?? undefined,
      },
    });
  }
}

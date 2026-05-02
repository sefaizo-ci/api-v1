import { Injectable } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../../../libs/database/prisma.service';
import {
  BookingCancellationRequestedEvent,
  BookingCreatedEvent,
} from '../../../client/interface/events/booking.events';
import {
  BookingCancellationRequestApprovedEvent,
  BookingCancellationRequestRejectedEvent,
  BookingCancelledEvent,
  BookingCompletedEvent,
  BookingConfirmedEvent,
  BookingRejectedEvent,
} from '../../../professional/interface/events/booking.events';
import {
  ProfessionalReactivatedEvent,
  ProfessionalSuspendedEvent,
  ProfessionalVerifiedEvent,
} from '../../../professional/interface/events/profile.events';
import { NotificationsService } from '../../application/notifications.service';

@EventsHandler(BookingCreatedEvent)
@Injectable()
export class OnBookingCreatedNotificationHandler implements IEventHandler<BookingCreatedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingCreatedEvent): Promise<void> {
    const booking = await this.getBookingContext(event.bookingId);
    if (!booking) {
      return;
    }

    await this.notificationsService.createFanoutNotification({
      userId: booking.professional.userId,
      type: 'BOOKING_CREATED',
      title: 'Nouvelle reservation',
      body: `${booking.client.firstName} ${booking.client.lastName} a reserve ${booking.service.name}.`,
      channels: [
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
        NotificationChannel.WHATSAPP,
      ],
      metadata: {
        bookingId: booking.id,
      },
    });
  }

  private async getBookingContext(bookingId: string) {
    return this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        deletedAt: null,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        professional: {
          select: {
            id: true,
            userId: true,
            agencyName: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}

@EventsHandler(BookingCancellationRequestedEvent)
@Injectable()
export class OnBookingCancellationRequestedNotificationHandler implements IEventHandler<BookingCancellationRequestedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingCancellationRequestedEvent): Promise<void> {
    const booking = await this.getBookingContext(event.bookingId);
    if (!booking) {
      return;
    }

    await this.notificationsService.createFanoutNotification({
      userId: booking.professional.userId,
      type: 'BOOKING_CANCELLATION_REQUESTED',
      title: "Demande d'annulation",
      body: `${booking.client.firstName} ${booking.client.lastName} a demande l'annulation de ${booking.service.name}.`,
      channels: [
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
        NotificationChannel.WHATSAPP,
      ],
      metadata: {
        bookingId: booking.id,
      },
    });
  }

  private async getBookingContext(bookingId: string) {
    return this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        deletedAt: null,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        professional: {
          select: {
            userId: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
      },
    });
  }
}

@EventsHandler(BookingConfirmedEvent)
@Injectable()
export class OnBookingConfirmedNotificationHandler implements IEventHandler<BookingConfirmedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingConfirmedEvent): Promise<void> {
    const booking = await this.getBookingContext(event.bookingId);
    if (!booking) {
      return;
    }

    await this.notificationsService.createFanoutNotification({
      userId: booking.clientId,
      type: 'BOOKING_CONFIRMED',
      title: 'Reservation confirmee',
      body: `${booking.professional.agencyName} a confirme votre reservation ${booking.service.name}.`,
      channels: [
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
        NotificationChannel.WHATSAPP,
      ],
      metadata: {
        bookingId: booking.id,
      },
    });

    await this.scheduleReminderNotifications(booking);
  }

  private async scheduleReminderNotifications(booking: {
    id: string;
    clientId: string;
    scheduledAt: Date;
    professional: { userId: string; agencyName: string };
    service: { name: string };
  }): Promise<void> {
    const reminders = [
      { label: 'RAPPEL_24H', msBefore: 24 * 60 * 60 * 1000 },
      { label: 'RAPPEL_2H', msBefore: 2 * 60 * 60 * 1000 },
    ];

    const now = Date.now();

    for (const reminder of reminders) {
      const scheduledFor = new Date(
        booking.scheduledAt.getTime() - reminder.msBefore,
      );
      if (scheduledFor.getTime() <= now) {
        continue;
      }

      await this.notificationsService.createFanoutNotification({
        userId: booking.clientId,
        type: reminder.label,
        title: 'Rappel de rendez-vous',
        body: `Votre rendez-vous ${booking.service.name} approche.`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        scheduledFor,
        metadata: {
          bookingId: booking.id,
          reminder: reminder.label,
        },
      });

      await this.notificationsService.createFanoutNotification({
        userId: booking.professional.userId,
        type: reminder.label,
        title: 'Rappel de rendez-vous',
        body: `Vous avez un rendez-vous ${booking.service.name} a venir.`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        scheduledFor,
        metadata: {
          bookingId: booking.id,
          reminder: reminder.label,
        },
      });
    }
  }

  private async getBookingContext(bookingId: string) {
    return this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        deletedAt: null,
      },
      include: {
        professional: {
          select: {
            userId: true,
            agencyName: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
      },
    });
  }
}

@EventsHandler(BookingRejectedEvent)
@Injectable()
export class OnBookingRejectedNotificationHandler implements IEventHandler<BookingRejectedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingRejectedEvent): Promise<void> {
    const booking = await this.getBookingContext(event.bookingId);
    if (!booking) {
      return;
    }

    await this.notificationsService.createFanoutNotification({
      userId: booking.clientId,
      type: 'BOOKING_REJECTED',
      title: 'Reservation refusee',
      body: `${booking.professional.agencyName} a refuse votre reservation ${booking.service.name}.`,
      channels: [
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
        NotificationChannel.SMS,
      ],
      metadata: {
        bookingId: booking.id,
      },
    });
  }

  private async getBookingContext(bookingId: string) {
    return this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        deletedAt: null,
      },
      include: {
        professional: {
          select: {
            agencyName: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
      },
    });
  }
}

@EventsHandler(BookingCompletedEvent)
@Injectable()
export class OnBookingCompletedNotificationHandler implements IEventHandler<BookingCompletedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingCompletedEvent): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: event.bookingId,
        deletedAt: null,
      },
      include: {
        professional: {
          select: {
            userId: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!booking) {
      return;
    }

    await this.notificationsService.createFanoutNotification({
      userId: booking.clientId,
      type: 'BOOKING_COMPLETED',
      title: 'Prestation terminee',
      body: `Votre prestation ${booking.service.name} est marquee comme terminee.`,
      channels: [NotificationChannel.IN_APP],
      metadata: {
        bookingId: booking.id,
      },
    });

    await this.notificationsService.createFanoutNotification({
      userId: booking.professional.userId,
      type: 'BOOKING_COMPLETED',
      title: 'Prestation terminee',
      body: `La prestation ${booking.service.name} est marquee comme terminee.`,
      channels: [NotificationChannel.IN_APP],
      metadata: {
        bookingId: booking.id,
      },
    });
  }
}

@EventsHandler(BookingCancelledEvent)
@Injectable()
export class OnBookingCancelledNotificationHandler implements IEventHandler<BookingCancelledEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingCancelledEvent): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: event.bookingId,
        deletedAt: null,
      },
      include: {
        professional: {
          select: {
            userId: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!booking) {
      return;
    }

    const clientChannels = [
      NotificationChannel.IN_APP,
      NotificationChannel.PUSH,
    ];
    const proChannels = [NotificationChannel.IN_APP, NotificationChannel.PUSH];

    if (event.cancelledByUserId !== booking.clientId) {
      await this.notificationsService.createFanoutNotification({
        userId: booking.clientId,
        type: 'BOOKING_CANCELLED',
        title: 'Reservation annulee',
        body: `Votre reservation ${booking.service.name} a ete annulee.`,
        channels: clientChannels,
        metadata: {
          bookingId: booking.id,
        },
      });
    }

    if (event.cancelledByUserId !== booking.professional.userId) {
      await this.notificationsService.createFanoutNotification({
        userId: booking.professional.userId,
        type: 'BOOKING_CANCELLED',
        title: 'Reservation annulee',
        body: `La reservation ${booking.service.name} a ete annulee.`,
        channels: proChannels,
        metadata: {
          bookingId: booking.id,
        },
      });
    }
  }
}

@EventsHandler(BookingCancellationRequestApprovedEvent)
@Injectable()
export class OnBookingCancellationRequestApprovedNotificationHandler implements IEventHandler<BookingCancellationRequestApprovedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingCancellationRequestApprovedEvent): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: event.bookingId,
        deletedAt: null,
      },
      include: {
        service: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!booking) {
      return;
    }

    await this.notificationsService.createFanoutNotification({
      userId: booking.clientId,
      type: 'BOOKING_CANCELLATION_APPROVED',
      title: 'Annulation acceptee',
      body: `Votre demande d'annulation pour ${booking.service.name} a ete acceptee.`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      metadata: {
        bookingId: booking.id,
      },
    });
  }
}

@EventsHandler(BookingCancellationRequestRejectedEvent)
@Injectable()
export class OnBookingCancellationRequestRejectedNotificationHandler implements IEventHandler<BookingCancellationRequestRejectedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingCancellationRequestRejectedEvent): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: event.bookingId,
        deletedAt: null,
      },
      include: {
        service: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!booking) {
      return;
    }

    await this.notificationsService.createFanoutNotification({
      userId: booking.clientId,
      type: 'BOOKING_CANCELLATION_REJECTED',
      title: 'Annulation refusee',
      body: `Votre demande d'annulation pour ${booking.service.name} a ete refusee.`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      metadata: {
        bookingId: booking.id,
      },
    });
  }
}

@EventsHandler(ProfessionalVerifiedEvent)
@Injectable()
export class OnProfessionalVerifiedNotificationHandler implements IEventHandler<ProfessionalVerifiedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: ProfessionalVerifiedEvent): Promise<void> {
    const professional = await this.prisma.professional.findFirst({
      where: {
        id: event.professionalId,
        deletedAt: null,
      },
      select: {
        userId: true,
      },
    });

    if (!professional) {
      return;
    }

    await this.notificationsService.createFanoutNotification({
      userId: professional.userId,
      type: 'PROFESSIONAL_VERIFIED',
      title: 'Profil verifie',
      body: 'Votre profil professionnel a ete verifie par un administrateur.',
      channels: [
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
        NotificationChannel.SMS,
      ],
    });
  }
}

@EventsHandler(ProfessionalSuspendedEvent)
@Injectable()
export class OnProfessionalSuspendedNotificationHandler implements IEventHandler<ProfessionalSuspendedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: ProfessionalSuspendedEvent): Promise<void> {
    const professional = await this.prisma.professional.findFirst({
      where: {
        id: event.professionalId,
        deletedAt: null,
      },
      select: {
        userId: true,
      },
    });

    if (!professional) {
      return;
    }

    await this.notificationsService.createFanoutNotification({
      userId: professional.userId,
      type: 'PROFESSIONAL_SUSPENDED',
      title: 'Profil suspendu',
      body: 'Votre profil professionnel a ete suspendu.',
      channels: [
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
        NotificationChannel.SMS,
      ],
    });
  }
}

@EventsHandler(ProfessionalReactivatedEvent)
@Injectable()
export class OnProfessionalReactivatedNotificationHandler implements IEventHandler<ProfessionalReactivatedEvent> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: ProfessionalReactivatedEvent): Promise<void> {
    const professional = await this.prisma.professional.findFirst({
      where: {
        id: event.professionalId,
        deletedAt: null,
      },
      select: {
        userId: true,
      },
    });

    if (!professional) {
      return;
    }

    await this.notificationsService.createFanoutNotification({
      userId: professional.userId,
      type: 'PROFESSIONAL_REACTIVATED',
      title: 'Profil reactive',
      body: 'Votre profil professionnel a ete reactive.',
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    });
  }
}

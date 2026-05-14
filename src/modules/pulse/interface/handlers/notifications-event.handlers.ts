import { Injectable, Logger } from '@nestjs/common';
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
  BookingNoShowEvent,
  BookingRejectedEvent,
} from '../../../professional/interface/events/booking.events';
import {
  ProfessionalCreatedEvent,
  ProfessionalReactivatedEvent,
  ProfessionalRejectedEvent,
  ProfessionalSuspendedEvent,
  ProfessionalVerifiedEvent,
} from '../../../professional/interface/events/profile.events';
import { NotificationsService } from '../../application/notifications.service';

// ─── Channel presets ─────────────────────────────────────────────────────────
const CH_APP_PUSH_WA = [
  NotificationChannel.IN_APP,
  NotificationChannel.PUSH,
  NotificationChannel.WHATSAPP,
];
const CH_APP_PUSH_SMS = [
  NotificationChannel.IN_APP,
  NotificationChannel.PUSH,
  NotificationChannel.SMS,
];
const CH_APP_PUSH = [NotificationChannel.IN_APP, NotificationChannel.PUSH];
const CH_APP = [NotificationChannel.IN_APP];

// ─── Shared booking context ───────────────────────────────────────────────────
async function fetchBookingForNotification(
  prisma: PrismaService,
  bookingId: string,
) {
  return prisma.booking.findFirst({
    where: { id: bookingId, deletedAt: null },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      professional: { select: { id: true, userId: true, agencyName: true } },
      service: { select: { id: true, name: true } },
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchAdminUserIds(prisma: PrismaService): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true, deletedAt: null },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

// ─── Handlers ────────────────────────────────────────────────────────────────

@EventsHandler(ProfessionalCreatedEvent)
@Injectable()
export class OnProfessionalCreatedNotificationHandler implements IEventHandler<ProfessionalCreatedEvent> {
  private readonly logger = new Logger(
    OnProfessionalCreatedNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: ProfessionalCreatedEvent): Promise<void> {
    try {
      const adminIds = await fetchAdminUserIds(this.prisma);
      if (adminIds.length === 0) return;

      await Promise.all(
        adminIds.map((adminId) =>
          this.notificationsService.createFanoutNotification({
            userId: adminId,
            type: 'PROFESSIONAL_CREATED',
            title: 'Nouveau professionnel',
            body: `${event.agencyName} vient de créer un compte et attend la vérification.`,
            channels: CH_APP_PUSH,
            metadata: { professionalId: event.professionalId },
          }),
        ),
      );
    } catch (err) {
      this.logger.error('OnProfessionalCreatedNotificationHandler failed', err);
    }
  }
}

@EventsHandler(BookingCreatedEvent)
@Injectable()
export class OnBookingCreatedNotificationHandler implements IEventHandler<BookingCreatedEvent> {
  private readonly logger = new Logger(
    OnBookingCreatedNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingCreatedEvent): Promise<void> {
    try {
      const booking = await fetchBookingForNotification(
        this.prisma,
        event.bookingId,
      );
      if (!booking) return;

      await this.notificationsService.createFanoutNotification({
        userId: booking.professional.userId,
        type: 'BOOKING_CREATED',
        title: 'Nouvelle reservation',
        body: `${booking.client.firstName} ${booking.client.lastName} a reserve ${booking.service.name}.`,
        channels: CH_APP_PUSH_WA,
        metadata: { bookingId: booking.id },
      });
    } catch (err) {
      this.logger.error('OnBookingCreatedNotificationHandler failed', err);
    }
  }
}

@EventsHandler(BookingCancellationRequestedEvent)
@Injectable()
export class OnBookingCancellationRequestedNotificationHandler implements IEventHandler<BookingCancellationRequestedEvent> {
  private readonly logger = new Logger(
    OnBookingCancellationRequestedNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingCancellationRequestedEvent): Promise<void> {
    try {
      const booking = await fetchBookingForNotification(
        this.prisma,
        event.bookingId,
      );
      if (!booking) return;

      await this.notificationsService.createFanoutNotification({
        userId: booking.professional.userId,
        type: 'BOOKING_CANCELLATION_REQUESTED',
        title: "Demande d'annulation",
        body: `${booking.client.firstName} ${booking.client.lastName} a demande l'annulation de ${booking.service.name}.`,
        channels: CH_APP_PUSH_WA,
        metadata: { bookingId: booking.id },
      });
    } catch (err) {
      this.logger.error(
        'OnBookingCancellationRequestedNotificationHandler failed',
        err,
      );
    }
  }
}

@EventsHandler(BookingConfirmedEvent)
@Injectable()
export class OnBookingConfirmedNotificationHandler implements IEventHandler<BookingConfirmedEvent> {
  private readonly logger = new Logger(
    OnBookingConfirmedNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingConfirmedEvent): Promise<void> {
    try {
      const booking = await fetchBookingForNotification(
        this.prisma,
        event.bookingId,
      );
      if (!booking) return;

      await this.notificationsService.createFanoutNotification({
        userId: booking.clientId,
        type: 'BOOKING_CONFIRMED',
        title: 'Reservation confirmee',
        body: `${booking.professional.agencyName} a confirme votre reservation ${booking.service.name}.`,
        channels: CH_APP_PUSH_WA,
        metadata: { bookingId: booking.id },
      });

      await this.scheduleReminders(booking);
    } catch (err) {
      this.logger.error('OnBookingConfirmedNotificationHandler failed', err);
    }
  }

  private async scheduleReminders(booking: {
    id: string;
    clientId: string;
    scheduledAt: Date;
    professional: { userId: string; agencyName: string };
    service: { name: string };
  }): Promise<void> {
    const REMINDERS = [
      { label: 'RAPPEL_24H', msBefore: 24 * 60 * 60 * 1000 },
      { label: 'RAPPEL_2H', msBefore: 2 * 60 * 60 * 1000 },
    ];
    const now = Date.now();

    for (const reminder of REMINDERS) {
      const scheduledFor = new Date(
        booking.scheduledAt.getTime() - reminder.msBefore,
      );
      if (scheduledFor.getTime() <= now) continue;

      await Promise.all([
        this.notificationsService.createFanoutNotification({
          userId: booking.clientId,
          type: reminder.label,
          title: 'Rappel de rendez-vous',
          body: `Votre rendez-vous ${booking.service.name} approche.`,
          channels: CH_APP_PUSH,
          scheduledFor,
          metadata: { bookingId: booking.id, reminder: reminder.label },
        }),
        this.notificationsService.createFanoutNotification({
          userId: booking.professional.userId,
          type: reminder.label,
          title: 'Rappel de rendez-vous',
          body: `Vous avez un rendez-vous ${booking.service.name} a venir.`,
          channels: CH_APP_PUSH,
          scheduledFor,
          metadata: { bookingId: booking.id, reminder: reminder.label },
        }),
      ]);
    }
  }
}

@EventsHandler(BookingRejectedEvent)
@Injectable()
export class OnBookingRejectedNotificationHandler implements IEventHandler<BookingRejectedEvent> {
  private readonly logger = new Logger(
    OnBookingRejectedNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingRejectedEvent): Promise<void> {
    try {
      const booking = await fetchBookingForNotification(
        this.prisma,
        event.bookingId,
      );
      if (!booking) return;

      await this.notificationsService.createFanoutNotification({
        userId: booking.clientId,
        type: 'BOOKING_REJECTED',
        title: 'Reservation refusee',
        body: `${booking.professional.agencyName} a refuse votre reservation ${booking.service.name}.`,
        channels: CH_APP_PUSH_SMS,
        metadata: { bookingId: booking.id },
      });
    } catch (err) {
      this.logger.error('OnBookingRejectedNotificationHandler failed', err);
    }
  }
}

@EventsHandler(BookingCompletedEvent)
@Injectable()
export class OnBookingCompletedNotificationHandler implements IEventHandler<BookingCompletedEvent> {
  private readonly logger = new Logger(
    OnBookingCompletedNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingCompletedEvent): Promise<void> {
    try {
      const booking = await fetchBookingForNotification(
        this.prisma,
        event.bookingId,
      );
      if (!booking) return;

      await Promise.all([
        this.notificationsService.createFanoutNotification({
          userId: booking.clientId,
          type: 'BOOKING_COMPLETED',
          title: 'Prestation terminee',
          body: `Votre prestation ${booking.service.name} est marquee comme terminee.`,
          channels: CH_APP,
          metadata: { bookingId: booking.id },
        }),
        this.notificationsService.createFanoutNotification({
          userId: booking.professional.userId,
          type: 'BOOKING_COMPLETED',
          title: 'Prestation terminee',
          body: `La prestation ${booking.service.name} est marquee comme terminee.`,
          channels: CH_APP,
          metadata: { bookingId: booking.id },
        }),
      ]);
    } catch (err) {
      this.logger.error('OnBookingCompletedNotificationHandler failed', err);
    }
  }
}

@EventsHandler(BookingCancelledEvent)
@Injectable()
export class OnBookingCancelledNotificationHandler implements IEventHandler<BookingCancelledEvent> {
  private readonly logger = new Logger(
    OnBookingCancelledNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingCancelledEvent): Promise<void> {
    try {
      const booking = await fetchBookingForNotification(
        this.prisma,
        event.bookingId,
      );
      if (!booking) return;

      const notifs: Promise<unknown>[] = [];

      if (event.cancelledByUserId !== booking.clientId) {
        notifs.push(
          this.notificationsService.createFanoutNotification({
            userId: booking.clientId,
            type: 'BOOKING_CANCELLED',
            title: 'Reservation annulee',
            body: `Votre reservation ${booking.service.name} a ete annulee.`,
            channels: CH_APP_PUSH,
            metadata: { bookingId: booking.id },
          }),
        );
      }

      if (event.cancelledByUserId !== booking.professional.userId) {
        notifs.push(
          this.notificationsService.createFanoutNotification({
            userId: booking.professional.userId,
            type: 'BOOKING_CANCELLED',
            title: 'Reservation annulee',
            body: `La reservation ${booking.service.name} a ete annulee.`,
            channels: CH_APP_PUSH,
            metadata: { bookingId: booking.id },
          }),
        );
      }

      await Promise.all(notifs);
    } catch (err) {
      this.logger.error('OnBookingCancelledNotificationHandler failed', err);
    }
  }
}

@EventsHandler(BookingCancellationRequestApprovedEvent)
@Injectable()
export class OnBookingCancellationRequestApprovedNotificationHandler implements IEventHandler<BookingCancellationRequestApprovedEvent> {
  private readonly logger = new Logger(
    OnBookingCancellationRequestApprovedNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingCancellationRequestApprovedEvent): Promise<void> {
    try {
      const booking = await fetchBookingForNotification(
        this.prisma,
        event.bookingId,
      );
      if (!booking) return;

      await this.notificationsService.createFanoutNotification({
        userId: booking.clientId,
        type: 'BOOKING_CANCELLATION_APPROVED',
        title: 'Annulation acceptee',
        body: `Votre demande d'annulation pour ${booking.service.name} a ete acceptee.`,
        channels: CH_APP_PUSH,
        metadata: { bookingId: booking.id },
      });
    } catch (err) {
      this.logger.error(
        'OnBookingCancellationRequestApprovedNotificationHandler failed',
        err,
      );
    }
  }
}

@EventsHandler(BookingCancellationRequestRejectedEvent)
@Injectable()
export class OnBookingCancellationRequestRejectedNotificationHandler implements IEventHandler<BookingCancellationRequestRejectedEvent> {
  private readonly logger = new Logger(
    OnBookingCancellationRequestRejectedNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingCancellationRequestRejectedEvent): Promise<void> {
    try {
      const booking = await fetchBookingForNotification(
        this.prisma,
        event.bookingId,
      );
      if (!booking) return;

      await this.notificationsService.createFanoutNotification({
        userId: booking.clientId,
        type: 'BOOKING_CANCELLATION_REJECTED',
        title: 'Annulation refusee',
        body: `Votre demande d'annulation pour ${booking.service.name} a ete refusee.`,
        channels: CH_APP_PUSH,
        metadata: { bookingId: booking.id },
      });
    } catch (err) {
      this.logger.error(
        'OnBookingCancellationRequestRejectedNotificationHandler failed',
        err,
      );
    }
  }
}

@EventsHandler(BookingNoShowEvent)
@Injectable()
export class OnBookingNoShowNotificationHandler implements IEventHandler<BookingNoShowEvent> {
  private readonly logger = new Logger(OnBookingNoShowNotificationHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: BookingNoShowEvent): Promise<void> {
    try {
      const booking = await fetchBookingForNotification(
        this.prisma,
        event.bookingId,
      );
      if (!booking) return;

      await this.notificationsService.createFanoutNotification({
        userId: booking.clientId,
        type: 'BOOKING_NO_SHOW',
        title: 'Absence enregistree',
        body: `Vous avez ete marque absent pour votre rendez-vous ${booking.service.name}.`,
        channels: CH_APP_PUSH,
        metadata: { bookingId: booking.id },
      });
    } catch (err) {
      this.logger.error('OnBookingNoShowNotificationHandler failed', err);
    }
  }
}

@EventsHandler(ProfessionalVerifiedEvent)
@Injectable()
export class OnProfessionalVerifiedNotificationHandler implements IEventHandler<ProfessionalVerifiedEvent> {
  private readonly logger = new Logger(
    OnProfessionalVerifiedNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: ProfessionalVerifiedEvent): Promise<void> {
    try {
      const professional = await this.prisma.professional.findFirst({
        where: { id: event.professionalId, deletedAt: null },
        select: { userId: true },
      });
      if (!professional) return;

      await this.notificationsService.createFanoutNotification({
        userId: professional.userId,
        type: 'PROFESSIONAL_VERIFIED',
        title: 'Profil verifie',
        body: 'Votre profil professionnel a ete verifie par un administrateur.',
        channels: CH_APP_PUSH_SMS,
      });
    } catch (err) {
      this.logger.error(
        'OnProfessionalVerifiedNotificationHandler failed',
        err,
      );
    }
  }
}

@EventsHandler(ProfessionalSuspendedEvent)
@Injectable()
export class OnProfessionalSuspendedNotificationHandler implements IEventHandler<ProfessionalSuspendedEvent> {
  private readonly logger = new Logger(
    OnProfessionalSuspendedNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: ProfessionalSuspendedEvent): Promise<void> {
    try {
      const professional = await this.prisma.professional.findFirst({
        where: { id: event.professionalId, deletedAt: null },
        select: { userId: true },
      });
      if (!professional) return;

      await this.notificationsService.createFanoutNotification({
        userId: professional.userId,
        type: 'PROFESSIONAL_SUSPENDED',
        title: 'Profil suspendu',
        body: 'Votre profil professionnel a ete suspendu.',
        channels: CH_APP_PUSH_SMS,
      });
    } catch (err) {
      this.logger.error(
        'OnProfessionalSuspendedNotificationHandler failed',
        err,
      );
    }
  }
}

@EventsHandler(ProfessionalReactivatedEvent)
@Injectable()
export class OnProfessionalReactivatedNotificationHandler implements IEventHandler<ProfessionalReactivatedEvent> {
  private readonly logger = new Logger(
    OnProfessionalReactivatedNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: ProfessionalReactivatedEvent): Promise<void> {
    try {
      const professional = await this.prisma.professional.findFirst({
        where: { id: event.professionalId, deletedAt: null },
        select: { userId: true },
      });
      if (!professional) return;

      await this.notificationsService.createFanoutNotification({
        userId: professional.userId,
        type: 'PROFESSIONAL_REACTIVATED',
        title: 'Profil reactive',
        body: 'Votre profil professionnel a ete reactive.',
        channels: CH_APP_PUSH,
      });
    } catch (err) {
      this.logger.error(
        'OnProfessionalReactivatedNotificationHandler failed',
        err,
      );
    }
  }
}

@EventsHandler(ProfessionalRejectedEvent)
@Injectable()
export class OnProfessionalRejectedNotificationHandler implements IEventHandler<ProfessionalRejectedEvent> {
  private readonly logger = new Logger(
    OnProfessionalRejectedNotificationHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(event: ProfessionalRejectedEvent): Promise<void> {
    try {
      const professional = await this.prisma.professional.findFirst({
        where: { id: event.professionalId, deletedAt: null },
        select: { userId: true },
      });
      if (!professional) return;

      await this.notificationsService.createFanoutNotification({
        userId: professional.userId,
        type: 'PROFESSIONAL_REJECTED',
        title: 'Profil refuse',
        body: event.reason,
        channels: CH_APP_PUSH_SMS,
        metadata: { professionalId: event.professionalId },
      });
    } catch (err) {
      this.logger.error(
        'OnProfessionalRejectedNotificationHandler failed',
        err,
      );
    }
  }
}

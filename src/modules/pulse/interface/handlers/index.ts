import {
  OnBookingCancellationRequestApprovedNotificationHandler,
  OnBookingCancellationRequestRejectedNotificationHandler,
  OnBookingCancellationRequestedNotificationHandler,
  OnBookingCancelledNotificationHandler,
  OnBookingCompletedNotificationHandler,
  OnBookingConfirmedNotificationHandler,
  OnBookingCreatedNotificationHandler,
  OnBookingNoShowNotificationHandler,
  OnBookingRejectedNotificationHandler,
  OnProfessionalReactivatedNotificationHandler,
  OnProfessionalSuspendedNotificationHandler,
  OnProfessionalVerifiedNotificationHandler,
} from './notifications-event.handlers';

export const NotificationEventHandlers = [
  OnBookingCreatedNotificationHandler,
  OnBookingCancellationRequestedNotificationHandler,
  OnBookingConfirmedNotificationHandler,
  OnBookingRejectedNotificationHandler,
  OnBookingCompletedNotificationHandler,
  OnBookingCancelledNotificationHandler,
  OnBookingCancellationRequestApprovedNotificationHandler,
  OnBookingCancellationRequestRejectedNotificationHandler,
  OnBookingNoShowNotificationHandler,
  OnProfessionalVerifiedNotificationHandler,
  OnProfessionalSuspendedNotificationHandler,
  OnProfessionalReactivatedNotificationHandler,
];

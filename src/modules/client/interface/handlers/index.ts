import {
  CreateClientBookingHandler,
  GetBookingStatusesHandler,
  GetMyBookingByIdHandler,
  GetMyBookingsHandler,
  RequestBookingCancellationHandler,
} from './booking.handlers';

export const ClientCommandHandlers = [
  CreateClientBookingHandler,
  RequestBookingCancellationHandler,
];

export const ClientQueryHandlers = [
  GetMyBookingsHandler,
  GetMyBookingByIdHandler,
  GetBookingStatusesHandler,
];

export * from './booking.handlers';

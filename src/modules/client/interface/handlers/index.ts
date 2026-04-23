import {
  CreateClientBookingHandler,
  GetMyBookingByIdHandler,
  GetMyBookingsHandler,
  RequestBookingCancellationHandler,
  UpdatePendingBookingHandler,
} from './booking.handlers';

export const ClientCommandHandlers = [
  CreateClientBookingHandler,
  UpdatePendingBookingHandler,
  RequestBookingCancellationHandler,
];

export const ClientQueryHandlers = [
  GetMyBookingsHandler,
  GetMyBookingByIdHandler,
];

export * from './booking.handlers';

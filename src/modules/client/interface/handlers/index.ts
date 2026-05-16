import {
  CreateClientBookingHandler,
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
];

export * from './booking.handlers';

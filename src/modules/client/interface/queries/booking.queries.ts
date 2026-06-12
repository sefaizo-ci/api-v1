import { IQuery } from '@nestjs/cqrs';

export class GetMyBookingsQuery implements IQuery {
  constructor(
    public readonly clientId: string,
    public readonly status?: string,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}

export class GetMyBookingByIdQuery implements IQuery {
  constructor(
    public readonly bookingId: string,
    public readonly clientId: string,
  ) {}
}

export class GetBookingStatusesQuery implements IQuery {}

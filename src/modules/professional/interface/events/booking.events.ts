import { IEvent } from '@nestjs/cqrs';

export class BookingConfirmedEvent implements IEvent {
  constructor(public readonly bookingId: string) {}
}

export class BookingRejectedEvent implements IEvent {
  constructor(public readonly bookingId: string) {}
}

export class BookingCompletedEvent implements IEvent {
  constructor(public readonly bookingId: string) {}
}

export class BookingCancelledEvent implements IEvent {
  constructor(
    public readonly bookingId: string,
    public readonly cancelledByUserId?: string,
  ) {}
}

export class BookingCancellationRequestApprovedEvent implements IEvent {
  constructor(public readonly bookingId: string) {}
}

export class BookingCancellationRequestRejectedEvent implements IEvent {
  constructor(public readonly bookingId: string) {}
}

export class BookingNoShowEvent implements IEvent {
  constructor(public readonly bookingId: string) {}
}

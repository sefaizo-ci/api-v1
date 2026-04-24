import { IEvent } from '@nestjs/cqrs';

export class BookingCreatedEvent implements IEvent {
  constructor(public readonly bookingId: string) {}
}

export class BookingCancellationRequestedEvent implements IEvent {
  constructor(public readonly bookingId: string) {}
}

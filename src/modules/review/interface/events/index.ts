import { IEvent } from '@nestjs/cqrs';

export class ReviewSessionRevealedEvent implements IEvent {
  constructor(
    public readonly sessionId: string,
    public readonly bookingId: string,
  ) {}
}

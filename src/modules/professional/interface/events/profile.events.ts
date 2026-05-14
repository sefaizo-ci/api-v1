import { IEvent } from '@nestjs/cqrs';

export class ProfessionalCreatedEvent implements IEvent {
  constructor(
    public readonly professionalId: string,
    public readonly agencyName: string,
  ) {}
}

export class ProfessionalVerifiedEvent implements IEvent {
  constructor(public readonly professionalId: string) {}
}

export class ProfessionalSuspendedEvent implements IEvent {
  constructor(public readonly professionalId: string) {}
}

export class ProfessionalReactivatedEvent implements IEvent {
  constructor(public readonly professionalId: string) {}
}

export class ProfessionalRejectedEvent implements IEvent {
  constructor(
    public readonly professionalId: string,
    public readonly reason: string,
  ) {}
}

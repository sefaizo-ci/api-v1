import { IEvent } from '@nestjs/cqrs';

export class ProfessionalVerifiedEvent implements IEvent {
  constructor(public readonly professionalId: string) {}
}

export class ProfessionalSuspendedEvent implements IEvent {
  constructor(public readonly professionalId: string) {}
}

export class ProfessionalReactivatedEvent implements IEvent {
  constructor(public readonly professionalId: string) {}
}

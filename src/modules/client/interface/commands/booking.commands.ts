import { ICommand } from '@nestjs/cqrs';

export class CreateClientBookingCommand implements ICommand {
  constructor(
    public readonly clientId: string,
    public readonly professionalId: string,
    public readonly serviceId: string,
    public readonly scheduledAt: string,
    public readonly commune: string,
    public readonly address?: string,
    public readonly clientNotes?: string,
  ) {}
}

export class UpdatePendingBookingCommand implements ICommand {
  constructor(
    public readonly bookingId: string,
    public readonly clientId: string,
    public readonly scheduledAt?: string,
    public readonly commune?: string,
    public readonly address?: string,
    public readonly clientNotes?: string,
  ) {}
}

export class RequestBookingCancellationCommand implements ICommand {
  constructor(
    public readonly bookingId: string,
    public readonly clientId: string,
    public readonly reason?: string,
  ) {}
}

import { ICommand } from '@nestjs/cqrs';

/**
 * ConfirmBookingCommand
 * Command for professional to confirm a booking request
 */
export class ConfirmBookingCommand implements ICommand {
  constructor(
    public readonly bookingId: string,
    public readonly professionalId: string,
  ) {}
}

/**
 * RejectBookingCommand
 * Command for professional to reject a booking request
 */
export class RejectBookingCommand implements ICommand {
  constructor(
    public readonly bookingId: string,
    public readonly professionalId: string,
    public readonly reason?: string,
  ) {}
}

/**
 * CompleteBookingCommand
 * Command to mark a booking as completed
 */
export class CompleteBookingCommand implements ICommand {
  constructor(
    public readonly bookingId: string,
    public readonly professionalId: string,
  ) {}
}

/**
 * CancelBookingCommand
 * Command to cancel a confirmed/pending booking
 */
export class CancelBookingCommand implements ICommand {
  constructor(
    public readonly bookingId: string,
    public readonly userId: string, // Could be pro or client
    public readonly reason?: string,
  ) {}
}

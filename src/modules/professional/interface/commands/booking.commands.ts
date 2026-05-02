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

/**
 * ApproveBookingCancellationRequestCommand
 * Command for professional to approve a client's cancellation request
 */
export class ApproveBookingCancellationRequestCommand implements ICommand {
  constructor(
    public readonly bookingId: string,
    public readonly professionalId: string,
  ) {}
}

/**
 * RejectBookingCancellationRequestCommand
 * Command for professional to reject a client's cancellation request
 */
export class RejectBookingCancellationRequestCommand implements ICommand {
  constructor(
    public readonly bookingId: string,
    public readonly professionalId: string,
    public readonly reason?: string,
  ) {}
}

/**
 * MarkNoShowCommand
 * Command for professional to mark a confirmed booking as no-show
 */
export class MarkNoShowCommand implements ICommand {
  constructor(
    public readonly bookingId: string,
    public readonly professionalId: string,
  ) {}
}

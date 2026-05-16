import { ICommand } from '@nestjs/cqrs';
import { ServiceLocation } from '../../core/enums';

/**
 * CreateProfessionalProfileCommand
 * Command to create a new professional profile for a user
 * Key constraint: One user can only have one professional profile
 */
export class CreateProfessionalProfileCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly agencyName: string,
    public readonly bio?: string,
    public readonly location?: ServiceLocation,
    public readonly address?: string,
    public readonly latitude?: number,
    public readonly longitude?: number,
  ) {}
}

/**
 * UpdateProfessionalProfileCommand
 * Command to update professional profile information
 */
export class UpdateProfessionalProfileCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly agencyName?: string,
    public readonly bio?: string,
    public readonly avatarUrl?: string,
    public readonly location?: ServiceLocation,
    public readonly address?: string,
    public readonly latitude?: number,
    public readonly longitude?: number,
  ) {}
}

/**
 * VerifyProfessionalCommand
 * Command to verify a professional profile (admin only)
 */
export class VerifyProfessionalCommand implements ICommand {
  constructor(public readonly professionalId: string) {}
}

/**
 * SuspendProfessionalCommand
 * Command to suspend a professional (admin only, e.g., due to violations)
 */
export class SuspendProfessionalCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly reason?: string,
  ) {}
}

/**
 * RejectProfessionalCommand
 * Command to reject a professional profile (admin only), with a mandatory reason
 */
export class RejectProfessionalCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly reason: string,
  ) {}
}

/**
 * ReactivateProfessionalCommand
 * Command to reactivate a suspended professional
 */
export class ReactivateProfessionalCommand implements ICommand {
  constructor(public readonly professionalId: string) {}
}

/**
 * ToggleListingCommand
 * Command for the professional to show/hide their own profile from public discovery
 */
export class ToggleListingCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly active: boolean,
  ) {}
}

/**
 * PauseBookingsCommand
 * Command for the professional to stop accepting new bookings, with an optional resume date
 */
export class PauseBookingsCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly resumeAt?: Date,
  ) {}
}

/**
 * ResumeBookingsCommand
 * Command for the professional to manually reopen bookings before the scheduled date
 */
export class ResumeBookingsCommand implements ICommand {
  constructor(public readonly professionalId: string) {}
}

/**
 * ResubmitProfessionalCommand
 * Allows a rejected professional to reset their status back to PENDING for re-review
 */
export class ResubmitProfessionalCommand implements ICommand {
  constructor(public readonly professionalId: string) {}
}

/**
 * UpdateProfessionalSettingsCommand
 * Updates operational settings for a professional (e.g., travel buffer)
 */
export class UpdateProfessionalSettingsCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly travelBufferMin: number,
  ) {}
}

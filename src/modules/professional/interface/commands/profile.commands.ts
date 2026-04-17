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
    public readonly avatarUrl?: string,
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
 * ReactivateProfessionalCommand
 * Command to reactivate a suspended professional
 */
export class ReactivateProfessionalCommand implements ICommand {
  constructor(public readonly professionalId: string) {}
}

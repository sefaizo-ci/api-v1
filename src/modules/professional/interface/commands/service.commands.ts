import { ICommand } from '@nestjs/cqrs';

/**
 * AddServiceCommand
 * Command to add a new service offering to a professional's portfolio
 */
export class AddServiceCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly name: string,
    public readonly description?: string,
    public readonly durationMin: number = 30,
    public readonly basePrice: number = 0,
    public readonly category: string = 'Other',
  ) {}
}

/**
 * UpdateServiceCommand
 * Command to update an existing service
 */
export class UpdateServiceCommand implements ICommand {
  constructor(
    public readonly serviceId: string,
    public readonly name?: string,
    public readonly description?: string,
    public readonly durationMin?: number,
    public readonly basePrice?: number,
    public readonly category?: string,
  ) {}
}

/**
 * DeleteServiceCommand
 * Command to delete (soft delete) a service
 */
export class DeleteServiceCommand implements ICommand {
  constructor(
    public readonly serviceId: string,
    public readonly professionalId: string,
  ) {}
}

/**
 * SetServiceCommuneFeeCommand
 * Command to set travel fee for a service in a specific commune
 */
export class SetServiceCommuneFeeCommand implements ICommand {
  constructor(
    public readonly serviceId: string,
    public readonly professionalId: string,
    public readonly commune: string,
    public readonly travelFee: number,
  ) {}
}

/**
 * ActivateServiceCommand
 * Command to reactivate a service
 */
export class ActivateServiceCommand implements ICommand {
  constructor(
    public readonly serviceId: string,
    public readonly professionalId: string,
  ) {}
}

/**
 * DeactivateServiceCommand
 * Command to deactivate a service (without deleting)
 */
export class DeactivateServiceCommand implements ICommand {
  constructor(
    public readonly serviceId: string,
    public readonly professionalId: string,
  ) {}
}

import { ICommand } from '@nestjs/cqrs';
import { AvailabilityStatus } from '../../core/enums';

/**
 * SetAvailabilityCommand
 * Command to set availability for a specific day of the week
 */
export class SetAvailabilityCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly dayOfWeek: number,
    public readonly startTime: string,
    public readonly endTime: string,
    public readonly breakStartTime?: string,
    public readonly breakEndTime?: string,
  ) {}
}

/**
 * UpdateAvailabilityCommand
 * Command to update existing availability for a day
 */
export class UpdateAvailabilityCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly dayOfWeek: number,
    public readonly startTime?: string,
    public readonly endTime?: string,
    public readonly breakStartTime?: string,
    public readonly breakEndTime?: string,
  ) {}
}

/**
 * RemoveAvailabilityCommand
 * Command to remove availability for a specific day
 */
export class RemoveAvailabilityCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly dayOfWeek: number,
  ) {}
}

/**
 * SetAvailabilityStatusCommand
 * Command to set special status for a day (OPEN, CLOSED, ON_LEAVE)
 */
export class SetAvailabilityStatusCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly dayOfWeek: number,
    public readonly status: AvailabilityStatus,
  ) {}
}

/**
 * SetAvailabilityForAllWeekCommand
 * Command to quickly set same availability for all days of the week
 */
export class SetAvailabilityForAllWeekCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly startTime: string,
    public readonly endTime: string,
    public readonly breakStartTime?: string,
    public readonly breakEndTime?: string,
    public readonly excludeDays?: number[],
  ) {}
}

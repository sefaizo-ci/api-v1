import { BadRequestException } from '../../../../libs/exceptions/domain.exceptions';
import { AvailabilityStatus } from '../enums';

/**
 * TimeRange ValueObject
 * Represents a time range (e.g., 08:00 - 18:00)
 */
export class TimeRangeVO {
  constructor(
    public readonly startTime: string, // Format "HH:mm"
    public readonly endTime: string, // Format "HH:mm"
  ) {
    this.validate();
  }

  private validate(): void {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(this.startTime) || !timeRegex.test(this.endTime)) {
      throw new BadRequestException('Invalid time format. Use HH:mm');
    }

    const [startHour, startMin] = this.startTime.split(':').map(Number);
    const [endHour, endMin] = this.endTime.split(':').map(Number);
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;

    if (startTotalMin >= endTotalMin) {
      throw new BadRequestException('Start time must be before end time');
    }
  }

  includes(time: string): boolean {
    const [hour, min] = time.split(':').map(Number);
    const totalMin = hour * 60 + min;
    const [startHour, startMin] = this.startTime.split(':').map(Number);
    const [endHour, endMin] = this.endTime.split(':').map(Number);
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;

    return totalMin >= startTotalMin && totalMin <= endTotalMin;
  }

  static create(startTime: string, endTime: string): TimeRangeVO {
    return new TimeRangeVO(startTime, endTime);
  }
}

/**
 * Availability Entity
 * Represents the availability schedule of a professional for a specific day of week
 */
export class AvailabilityEntity {
  id: string;
  professionalId: string;
  dayOfWeek: number;
  workingHours: TimeRangeVO;
  breakTime?: TimeRangeVO;
  status: AvailabilityStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  constructor(props: {
    id: string;
    professionalId: string;
    dayOfWeek: number;
    workingHours: TimeRangeVO;
    breakTime?: TimeRangeVO;
    status?: AvailabilityStatus;
    isActive?: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
  }) {
    this.id = props.id;
    this.professionalId = props.professionalId;
    this.dayOfWeek = props.dayOfWeek;
    this.workingHours = props.workingHours;
    this.breakTime = props.breakTime;
    this.status = props.status ?? AvailabilityStatus.OPEN;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: {
    id: string;
    professionalId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    breakStartTime?: string;
    breakEndTime?: string;
  }): AvailabilityEntity {
    if (props.dayOfWeek < 0 || props.dayOfWeek > 6) {
      throw new BadRequestException('Day of week must be between 0 and 6');
    }

    const workingHours = TimeRangeVO.create(props.startTime, props.endTime);
    let breakTime: TimeRangeVO | undefined;

    if (props.breakStartTime && props.breakEndTime) {
      breakTime = TimeRangeVO.create(props.breakStartTime, props.breakEndTime);
      // Validate break time is within working hours
      if (
        !workingHours.includes(props.breakStartTime) ||
        !workingHours.includes(props.breakEndTime)
      ) {
        throw new BadRequestException(
          'Break time must be within working hours',
        );
      }
    }

    return new AvailabilityEntity({
      ...props,
      id: props.id,
      workingHours,
      breakTime,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Check if a specific time is available (considering break time)
   */
  isTimeAvailable(time: string): boolean {
    if (!this.isActive || this.status !== AvailabilityStatus.OPEN) {
      return false;
    }
    if (!this.workingHours.includes(time)) {
      return false;
    }
    if (this.breakTime && this.breakTime.includes(time)) {
      return false;
    }
    return true;
  }

  /**
   * Mark professional as on leave for this day
   */
  markAsOnLeave(): void {
    this.status = AvailabilityStatus.ON_LEAVE;
    this.updatedAt = new Date();
  }

  /**
   * Mark professional as closed for this day
   */
  markAsClosed(): void {
    this.status = AvailabilityStatus.CLOSED;
    this.updatedAt = new Date();
  }

  /**
   * Reopen this day
   */
  reopen(): void {
    this.status = AvailabilityStatus.OPEN;
    this.updatedAt = new Date();
  }

  /**
   * Deactivate availability
   */
  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /**
   * Check if availability is valid and active
   */
  isValid(): boolean {
    return (
      this.isActive &&
      !this.deletedAt &&
      this.status !== AvailabilityStatus.CLOSED
    );
  }
}

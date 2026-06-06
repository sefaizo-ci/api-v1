import { Injectable } from '@nestjs/common';
import {
  BadRequestException,
  NotFoundException,
} from '../../../../libs/exceptions/domain.exceptions';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { AvailabilityEntity } from '../../core/entities/availability.entity';
import { AvailabilityStatus } from '../../core/enums';
import { ProfessionalRepository } from '../../infrastructure/persistence/professional.repository';
import {
  RemoveAvailabilityCommand,
  SetAvailabilityBulkCommand,
  SetAvailabilityCommand,
  SetAvailabilityForAllWeekCommand,
  SetAvailabilityStatusCommand,
  UpdateAvailabilityCommand,
} from '../../interface/commands';

@CommandHandler(SetAvailabilityCommand)
@Injectable()
export class SetAvailabilityHandler implements ICommandHandler<SetAvailabilityCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: SetAvailabilityCommand): Promise<AvailabilityEntity> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const availability = AvailabilityEntity.create({
      id: randomUUID(),
      professionalId: professional.id,
      dayOfWeek: command.dayOfWeek,
      startTime: command.startTime,
      endTime: command.endTime,
      breakStartTime: command.breakStartTime,
      breakEndTime: command.breakEndTime,
    });

    professional.addAvailability(availability);
    await this.repository.save(professional);

    return availability;
  }
}

@CommandHandler(SetAvailabilityBulkCommand)
@Injectable()
export class SetAvailabilityBulkHandler implements ICommandHandler<SetAvailabilityBulkCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(
    command: SetAvailabilityBulkCommand,
  ): Promise<AvailabilityEntity[]> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const results: AvailabilityEntity[] = [];

    for (const slot of command.slots) {
      const existing = professional.getAvailability(slot.dayOfWeek);
      const availability = AvailabilityEntity.create({
        id: existing?.id ?? randomUUID(),
        professionalId: professional.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        breakStartTime: slot.breakStartTime,
        breakEndTime: slot.breakEndTime,
      });

      if (existing) {
        availability.status = existing.status;
        professional.updateAvailability(slot.dayOfWeek, availability);
      } else {
        professional.addAvailability(availability);
      }

      results.push(availability);
    }

    await this.repository.save(professional);
    return results;
  }
}

@CommandHandler(UpdateAvailabilityCommand)
@Injectable()
export class UpdateAvailabilityHandler implements ICommandHandler<UpdateAvailabilityCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(
    command: UpdateAvailabilityCommand,
  ): Promise<AvailabilityEntity> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const current = professional.getAvailability(command.dayOfWeek);
    if (!current) {
      throw new NotFoundException('Disponibilite non trouvee pour ce jour');
    }

    const startTime = command.startTime ?? current.workingHours.startTime;
    const endTime = command.endTime ?? current.workingHours.endTime;
    const breakStartTime =
      command.breakStartTime !== undefined
        ? command.breakStartTime
        : current.breakTime?.startTime;
    const breakEndTime =
      command.breakEndTime !== undefined
        ? command.breakEndTime
        : current.breakTime?.endTime;

    const updated = AvailabilityEntity.create({
      id: current.id,
      professionalId: professional.id,
      dayOfWeek: command.dayOfWeek,
      startTime,
      endTime,
      breakStartTime,
      breakEndTime,
    });
    updated.status = current.status;

    professional.updateAvailability(command.dayOfWeek, updated);
    await this.repository.save(professional);

    const result = professional.getAvailability(command.dayOfWeek);
    if (!result) {
      throw new BadRequestException('Echec de mise a jour de la disponibilite');
    }

    return result;
  }
}

@CommandHandler(RemoveAvailabilityCommand)
@Injectable()
export class RemoveAvailabilityHandler implements ICommandHandler<RemoveAvailabilityCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: RemoveAvailabilityCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    professional.removeAvailability(command.dayOfWeek);
    await this.repository.save(professional);
  }
}

@CommandHandler(SetAvailabilityStatusCommand)
@Injectable()
export class SetAvailabilityStatusHandler implements ICommandHandler<SetAvailabilityStatusCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: SetAvailabilityStatusCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const availability = professional.getAvailability(command.dayOfWeek);
    if (!availability) {
      throw new NotFoundException('Disponibilite non trouvee pour ce jour');
    }

    if (command.status === AvailabilityStatus.OPEN) {
      availability.reopen();
    } else if (command.status === AvailabilityStatus.CLOSED) {
      availability.markAsClosed();
    } else {
      availability.markAsOnLeave();
    }

    await this.repository.save(professional);
  }
}

@CommandHandler(SetAvailabilityForAllWeekCommand)
@Injectable()
export class SetAvailabilityForAllWeekHandler implements ICommandHandler<SetAvailabilityForAllWeekCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: SetAvailabilityForAllWeekCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const excluded = new Set(command.excludeDays ?? []);

    for (let day = 0; day <= 6; day += 1) {
      if (excluded.has(day)) {
        continue;
      }

      const existing = professional.getAvailability(day);
      const availability = AvailabilityEntity.create({
        id: existing?.id ?? randomUUID(),
        professionalId: professional.id,
        dayOfWeek: day,
        startTime: command.startTime,
        endTime: command.endTime,
        breakStartTime: command.breakStartTime,
        breakEndTime: command.breakEndTime,
      });

      if (existing) {
        availability.status = existing.status;
        professional.updateAvailability(day, availability);
      } else {
        professional.addAvailability(availability);
      }
    }

    await this.repository.save(professional);
  }
}

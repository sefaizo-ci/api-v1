import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { ServiceOfferingEntity } from '../../core/entities/service-offering.entity';
import { ProfessionalRepository } from '../../infrastructure/persistence/professional.repository';
import {
  ActivateServiceCommand,
  AddServiceCommand,
  DeactivateServiceCommand,
  DeleteServiceCommand,
  SetServiceCommuneFeeCommand,
  UpdateServiceCommand,
} from '../../interface/commands';

/**
 * AddServiceHandler
 * Handles adding a new service to a professional's offerings
 */
@CommandHandler(AddServiceCommand)
@Injectable()
export class AddServiceHandler implements ICommandHandler<AddServiceCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: AddServiceCommand): Promise<ServiceOfferingEntity> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    const service = ServiceOfferingEntity.create({
      id: randomUUID(),
      professionalId: command.professionalId,
      name: command.name,
      description: command.description,
      durationMin: command.durationMin,
      basePrice: command.basePrice,
      category: command.category,
    });

    professional.addService(service);

    await this.repository.save(professional);

    return service;
  }
}

/**
 * UpdateServiceHandler
 * Handles updating service details
 */
@CommandHandler(UpdateServiceCommand)
@Injectable()
export class UpdateServiceHandler implements ICommandHandler<UpdateServiceCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: UpdateServiceCommand): Promise<ServiceOfferingEntity> {
    const professionals = await this.repository.findAll();
    const owner = professionals.find((p) =>
      p.services.some((s) => s.id === command.serviceId && !s.deletedAt),
    );

    if (!owner) {
      throw new NotFoundException('Service non trouve');
    }

    const service = owner.getService(command.serviceId);
    if (!service) {
      throw new NotFoundException('Service non trouve');
    }

    if (command.durationMin !== undefined && command.durationMin <= 0) {
      throw new BadRequestException('Duration must be greater than 0');
    }

    if (command.basePrice !== undefined && command.basePrice < 0) {
      throw new BadRequestException('Price cannot be negative');
    }

    if (command.name !== undefined) {
      service.name = command.name;
    }
    if (command.description !== undefined) {
      service.description = command.description;
    }
    if (command.durationMin !== undefined) {
      service.durationMin = command.durationMin;
    }
    if (command.basePrice !== undefined) {
      service.basePrice = command.basePrice;
    }
    if (command.category !== undefined) {
      service.category = command.category;
    }

    service.updatedAt = new Date();
    await this.repository.save(owner);

    return service;
  }
}

/**
 * DeleteServiceHandler
 * Handles soft deletion of service
 */
@CommandHandler(DeleteServiceCommand)
@Injectable()
export class DeleteServiceHandler implements ICommandHandler<DeleteServiceCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: DeleteServiceCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    professional.removeService(command.serviceId);
    await this.repository.save(professional);
  }
}

/**
 * SetServiceCommuneFeeHandler
 * Handles setting travel fee for a service in a specific commune
 */
@CommandHandler(SetServiceCommuneFeeCommand)
@Injectable()
export class SetServiceCommuneFeeHandler implements ICommandHandler<SetServiceCommuneFeeCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: SetServiceCommuneFeeCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    const service = professional.getService(command.serviceId);
    if (!service) {
      throw new NotFoundException('Service non trouvé');
    }

    if (command.travelFee < 0) {
      throw new BadRequestException('Travel fee cannot be negative');
    }

    service.setCommeFee(command.commune, command.travelFee);
    await this.repository.save(professional);
  }
}

/**
 * ActivateServiceHandler
 * Handles reactivating a deactivated service
 */
@CommandHandler(ActivateServiceCommand)
@Injectable()
export class ActivateServiceHandler implements ICommandHandler<ActivateServiceCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: ActivateServiceCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    const service = professional.getService(command.serviceId);
    if (!service) {
      throw new NotFoundException('Service non trouvé');
    }

    service.activate();
    await this.repository.save(professional);
  }
}

/**
 * DeactivateServiceHandler
 * Handles deactivating a service (temporarily hide without deleting)
 */
@CommandHandler(DeactivateServiceCommand)
@Injectable()
export class DeactivateServiceHandler implements ICommandHandler<DeactivateServiceCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: DeactivateServiceCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    const service = professional.getService(command.serviceId);
    if (!service) {
      throw new NotFoundException('Service non trouvé');
    }

    service.deactivate();
    await this.repository.save(professional);
  }
}

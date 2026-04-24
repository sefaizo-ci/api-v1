import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { ProfessionalEntity } from '../../core/entities/professional.entity';
import { ProfessionalRepository } from '../../infrastructure/persistence/professional.repository';
import {
  CreateProfessionalProfileCommand,
  ReactivateProfessionalCommand,
  SuspendProfessionalCommand,
  UpdateProfessionalProfileCommand,
  VerifyProfessionalCommand,
} from '../../interface/commands';
import {
  ProfessionalReactivatedEvent,
  ProfessionalSuspendedEvent,
  ProfessionalVerifiedEvent,
} from '../events/profile.events';

/**
 * CreateProfessionalProfileHandler
 * Handles creation of a new professional profile
 * Key constraint: One user = One professional profile
 */
@CommandHandler(CreateProfessionalProfileCommand)
@Injectable()
export class CreateProfessionalProfileHandler implements ICommandHandler<CreateProfessionalProfileCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(
    command: CreateProfessionalProfileCommand,
  ): Promise<ProfessionalEntity> {
    // Check if user already has a professional profile
    const existing = await this.repository.hasProfile(command.userId);
    if (existing) {
      throw new BadRequestException(
        "Un utilisateur ne peut avoir qu'un seul profil professionnel",
      );
    }

    // Create new professional entity
    const professional = ProfessionalEntity.create({
      id: randomUUID(),
      userId: command.userId,
      agencyName: command.agencyName,
      bio: command.bio,
      avatarUrl: command.avatarUrl,
      location: command.location,
      address: command.address,
      latitude: command.latitude,
      longitude: command.longitude,
    });

    await this.repository.save(professional);

    return professional;
  }
}

/**
 * UpdateProfessionalProfileHandler
 * Handles updates to professional profile information
 */
@CommandHandler(UpdateProfessionalProfileCommand)
@Injectable()
export class UpdateProfessionalProfileHandler implements ICommandHandler<UpdateProfessionalProfileCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(
    command: UpdateProfessionalProfileCommand,
  ): Promise<ProfessionalEntity> {
    // Fetch existing professional
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    // Update profile
    professional.updateProfile({
      agencyName: command.agencyName,
      bio: command.bio,
      avatarUrl: command.avatarUrl,
      location: command.location,
      address: command.address,
      latitude: command.latitude,
      longitude: command.longitude,
    });

    await this.repository.save(professional);

    return professional;
  }
}

/**
 * VerifyProfessionalHandler
 * Handles verification of professional profile (admin only)
 */
@CommandHandler(VerifyProfessionalCommand)
@Injectable()
export class VerifyProfessionalHandler implements ICommandHandler<VerifyProfessionalCommand> {
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(
    command: VerifyProfessionalCommand,
  ): Promise<ProfessionalEntity> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    professional.verify();
    await this.repository.save(professional);
    this.eventBus.publish(new ProfessionalVerifiedEvent(professional.id));

    return professional;
  }
}

/**
 * SuspendProfessionalHandler
 * Handles suspension of professional (admin only)
 */
@CommandHandler(SuspendProfessionalCommand)
@Injectable()
export class SuspendProfessionalHandler implements ICommandHandler<SuspendProfessionalCommand> {
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(
    command: SuspendProfessionalCommand,
  ): Promise<ProfessionalEntity> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    professional.suspend();
    await this.repository.save(professional);
    this.eventBus.publish(new ProfessionalSuspendedEvent(professional.id));

    return professional;
  }
}

/**
 * ReactivateProfessionalHandler
 * Handles reactivation of suspended professional
 */
@CommandHandler(ReactivateProfessionalCommand)
@Injectable()
export class ReactivateProfessionalHandler implements ICommandHandler<ReactivateProfessionalCommand> {
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(
    command: ReactivateProfessionalCommand,
  ): Promise<ProfessionalEntity> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    professional.reactivate();
    await this.repository.save(professional);
    this.eventBus.publish(new ProfessionalReactivatedEvent(professional.id));

    return professional;
  }
}

import { Injectable } from '@nestjs/common';
import {
  BadRequestException,
  NotFoundException,
} from '../../../../libs/exceptions/domain.exceptions';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../libs/database/prisma.service';
import { ProfessionalEligibilityService } from '../../../sentinel/services/professional-eligibility.service';
import { ProfessionalEntity } from '../../core/entities/professional.entity';
import { ProfessionalRepository } from '../../infrastructure/persistence/professional.repository';
import {
  CreateProfessionalProfileCommand,
  PauseBookingsCommand,
  ReactivateProfessionalCommand,
  RejectProfessionalCommand,
  ResubmitProfessionalCommand,
  ResumeBookingsCommand,
  SuspendProfessionalCommand,
  RemoveAvatarCommand,
  AddProfileImageCommand,
  RemoveProfileImageCommand,
  SetProfileImagesCommand,
  SetPrimaryProfileImageCommand,
  ToggleListingCommand,
  UpdateProfessionalProfileCommand,
  UpdateProfessionalSettingsCommand,
  VerifyProfessionalCommand,
} from '../../interface/commands';
import {
  ProfessionalCreatedEvent,
  ProfessionalReactivatedEvent,
  ProfessionalRejectedEvent,
  ProfessionalSuspendedEvent,
  ProfessionalVerifiedEvent,
} from '../events/profile.events';

async function findProfessionalOrFail(
  repository: ProfessionalRepository,
  id: string,
): Promise<ProfessionalEntity> {
  const professional = await repository.findById(id);
  if (!professional) throw new NotFoundException('Professionnel non trouvé');
  return professional;
}

async function executeStatusAction(
  repository: ProfessionalRepository,
  eventBus: EventBus,
  professionalId: string,
  action: (pro: ProfessionalEntity) => void,
  buildEvent: (id: string) => object,
): Promise<ProfessionalEntity> {
  const professional = await findProfessionalOrFail(repository, professionalId);
  action(professional);
  await repository.save(professional);
  eventBus.publish(buildEvent(professional.id));
  return professional;
}

/**
 * CreateProfessionalProfileHandler
 * Handles creation of a new professional profile
 * Key constraint: One user = One professional profile
 */
@CommandHandler(CreateProfessionalProfileCommand)
@Injectable()
export class CreateProfessionalProfileHandler implements ICommandHandler<CreateProfessionalProfileCommand> {
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly eventBus: EventBus,
    private readonly eligibility: ProfessionalEligibilityService,
  ) {}

  async execute(
    command: CreateProfessionalProfileCommand,
  ): Promise<ProfessionalEntity> {
    const existing = await this.repository.hasProfile(command.userId);
    if (existing) {
      throw new BadRequestException(
        "Un utilisateur ne peut avoir qu'un seul compte pro",
      );
    }

    const professional = ProfessionalEntity.create({
      id: randomUUID(),
      userId: command.userId,
      agencyName: command.agencyName,
      bio: command.bio,
      location: command.location,
      address: command.address,
      latitude: command.latitude,
      longitude: command.longitude,
      amenities: command.amenities,
      mainCategories: command.mainCategories,
    });

    await this.repository.save(professional);
    this.eventBus.publish(
      new ProfessionalCreatedEvent(professional.id, professional.agencyName),
    );

    await this.eligibility.refresh(command.userId);

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
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly eligibility: ProfessionalEligibilityService,
  ) {}

  async execute(
    command: UpdateProfessionalProfileCommand,
  ): Promise<ProfessionalEntity> {
    const professional = await findProfessionalOrFail(
      this.repository,
      command.professionalId,
    );

    professional.updateProfile({
      agencyName: command.agencyName,
      bio: command.bio,
      avatarUrl: command.avatarUrl,
      location: command.location,
      address: command.address,
      latitude: command.latitude,
      longitude: command.longitude,
      amenities: command.amenities,
      mainCategories: command.mainCategories,
    });

    await this.repository.save(professional);
    await this.eligibility.refresh(professional.userId);

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
    return executeStatusAction(
      this.repository,
      this.eventBus,
      command.professionalId,
      (pro) => pro.verify(),
      (id) => new ProfessionalVerifiedEvent(id),
    );
  }
}

/**
 * RejectProfessionalHandler
 * Handles rejection of a professional profile (admin only)
 */
@CommandHandler(RejectProfessionalCommand)
@Injectable()
export class RejectProfessionalHandler implements ICommandHandler<RejectProfessionalCommand> {
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(
    command: RejectProfessionalCommand,
  ): Promise<ProfessionalEntity> {
    const professional = await findProfessionalOrFail(
      this.repository,
      command.professionalId,
    );
    professional.reject(command.reason);
    await this.repository.save(professional);
    this.eventBus.publish(
      new ProfessionalRejectedEvent(professional.id, command.reason),
    );
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
    return executeStatusAction(
      this.repository,
      this.eventBus,
      command.professionalId,
      (pro) => pro.suspend(),
      (id) => new ProfessionalSuspendedEvent(id),
    );
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
    return executeStatusAction(
      this.repository,
      this.eventBus,
      command.professionalId,
      (pro) => pro.reactivate(),
      (id) => new ProfessionalReactivatedEvent(id),
    );
  }
}

/**
 * ToggleListingHandler
 * Allows the professional to show or hide their profile from public discovery
 */
@CommandHandler(ToggleListingCommand)
@Injectable()
export class ToggleListingHandler implements ICommandHandler<ToggleListingCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: ToggleListingCommand): Promise<ProfessionalEntity> {
    const professional = await findProfessionalOrFail(
      this.repository,
      command.professionalId,
    );

    if (command.active) {
      professional.activateListing();
    } else {
      professional.deactivateListing();
    }

    await this.repository.save(professional);
    return professional;
  }
}

/**
 * PauseBookingsHandler
 * Stops accepting new bookings, with an optional automatic resume date
 */
@CommandHandler(PauseBookingsCommand)
@Injectable()
export class PauseBookingsHandler implements ICommandHandler<PauseBookingsCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: PauseBookingsCommand): Promise<ProfessionalEntity> {
    const professional = await findProfessionalOrFail(
      this.repository,
      command.professionalId,
    );

    professional.pauseBookings(command.resumeAt);
    await this.repository.save(professional);
    return professional;
  }
}

/**
 * ResumeBookingsHandler
 * Manually reopens bookings before the scheduled resume date
 */
@CommandHandler(ResumeBookingsCommand)
@Injectable()
export class ResumeBookingsHandler implements ICommandHandler<ResumeBookingsCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: ResumeBookingsCommand): Promise<ProfessionalEntity> {
    const professional = await findProfessionalOrFail(
      this.repository,
      command.professionalId,
    );

    professional.resumeBookings();
    await this.repository.save(professional);
    return professional;
  }
}

/**
 * ResubmitProfessionalHandler
 * Allows a rejected professional to reset their status to PENDING for re-review
 */
@CommandHandler(ResubmitProfessionalCommand)
@Injectable()
export class ResubmitProfessionalHandler implements ICommandHandler<ResubmitProfessionalCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(
    command: ResubmitProfessionalCommand,
  ): Promise<ProfessionalEntity> {
    const professional = await findProfessionalOrFail(
      this.repository,
      command.professionalId,
    );

    professional.resubmit();
    await this.repository.save(professional);
    return professional;
  }
}

@CommandHandler(UpdateProfessionalSettingsCommand)
@Injectable()
export class UpdateProfessionalSettingsHandler implements ICommandHandler<UpdateProfessionalSettingsCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateProfessionalSettingsCommand): Promise<void> {
    const professional = await this.prisma.professional.findFirst({
      where: { id: command.professionalId, deletedAt: null },
      select: { id: true },
    });

    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    await this.prisma.professional.update({
      where: { id: command.professionalId },
      data: { travelBufferMin: command.travelBufferMin },
    });
  }
}

@CommandHandler(RemoveAvatarCommand)
@Injectable()
export class RemoveAvatarHandler implements ICommandHandler<RemoveAvatarCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: RemoveAvatarCommand): Promise<void> {
    const professional = await this.prisma.professional.findFirst({
      where: { id: command.professionalId, deletedAt: null },
      select: { id: true },
    });

    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    await this.prisma.professional.update({
      where: { id: command.professionalId },
      data: { avatarUrl: null },
    });
  }
}

/**
 * AddProfileImageHandler
 * Appends an image to the professional's profile images list.
 */
@CommandHandler(AddProfileImageCommand)
@Injectable()
export class AddProfileImageHandler implements ICommandHandler<AddProfileImageCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: AddProfileImageCommand): Promise<ProfessionalEntity> {
    const professional = await findProfessionalOrFail(
      this.repository,
      command.professionalId,
    );
    professional.addProfileImage(command.imageUrl);
    await this.repository.save(professional);
    return professional;
  }
}

/**
 * RemoveProfileImageHandler
 * Removes an image from the professional's profile images list.
 */
@CommandHandler(RemoveProfileImageCommand)
@Injectable()
export class RemoveProfileImageHandler implements ICommandHandler<RemoveProfileImageCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(
    command: RemoveProfileImageCommand,
  ): Promise<ProfessionalEntity> {
    const professional = await findProfessionalOrFail(
      this.repository,
      command.professionalId,
    );
    professional.removeProfileImage(command.imageUrl);
    await this.repository.save(professional);
    return professional;
  }
}

/**
 * SetProfileImagesHandler
 * Replaces the whole profile images list at once.
 */
@CommandHandler(SetProfileImagesCommand)
@Injectable()
export class SetProfileImagesHandler implements ICommandHandler<SetProfileImagesCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: SetProfileImagesCommand): Promise<ProfessionalEntity> {
    const professional = await findProfessionalOrFail(
      this.repository,
      command.professionalId,
    );
    professional.setProfileImages(command.imageUrls);
    await this.repository.save(professional);
    return professional;
  }
}

/**
 * SetPrimaryProfileImageHandler
 * Promotes one profile image as the primary image (avatar).
 */
@CommandHandler(SetPrimaryProfileImageCommand)
@Injectable()
export class SetPrimaryProfileImageHandler implements ICommandHandler<SetPrimaryProfileImageCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(
    command: SetPrimaryProfileImageCommand,
  ): Promise<ProfessionalEntity> {
    const professional = await findProfessionalOrFail(
      this.repository,
      command.professionalId,
    );
    professional.setPrimaryImage(command.imageUrl);
    await this.repository.save(professional);
    return professional;
  }
}

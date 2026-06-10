import { Injectable } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../../../../libs/exceptions/domain.exceptions';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BookingStatus, ServiceCategoryRequestStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../libs/database/prisma.service';
import { ServiceOfferingEntity } from '../../core/entities/service-offering.entity';
import { ProfessionalRepository } from '../../infrastructure/persistence/professional.repository';
import { ProfessionalEligibilityService } from '../../../sentinel/services/professional-eligibility.service';
import {
  ActivateServiceCommand,
  AddServiceCommand,
  AddServiceImageCommand,
  ApproveServiceCategoryRequestCommand,
  CreateServiceCategoryCommand,
  CreateServiceCategoryRequestCommand,
  DeactivateServiceCommand,
  DeleteServiceCategoryCommand,
  DeleteServiceCommand,
  RejectServiceCategoryRequestCommand,
  RemoveServiceImageCommand,
  SetServiceCommuneFeeCommand,
  UpdateServiceCategoryCommand,
  UpdateServiceCommand,
  UpsertServicesBulkCommand,
} from '../../interface/commands';

function toCategorySlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

@CommandHandler(CreateServiceCategoryCommand)
@Injectable()
export class CreateServiceCategoryHandler implements ICommandHandler<CreateServiceCategoryCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CreateServiceCategoryCommand) {
    const categoryName = command.name.trim();
    if (!categoryName) {
      throw new BadRequestException('Le nom de la categorie est requis');
    }

    const existing = await this.prisma.serviceCategory.findFirst({
      where: {
        name: {
          equals: categoryName,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('Cette categorie existe deja');
    }

    return this.prisma.serviceCategory.create({
      data: {
        name: categoryName,
        slug: toCategorySlug(categoryName),
        description: command.description?.trim() || null,
        metadata: command.createdBy
          ? {
              createdBy: command.createdBy,
            }
          : undefined,
      },
    });
  }
}

@CommandHandler(UpdateServiceCategoryCommand)
@Injectable()
export class UpdateServiceCategoryHandler implements ICommandHandler<UpdateServiceCategoryCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateServiceCategoryCommand) {
    const category = await this.prisma.serviceCategory.findFirst({
      where: {
        id: command.categoryId,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new NotFoundException('Categorie non trouvee');
    }

    const nextName = command.name?.trim();
    if (nextName) {
      const duplicate = await this.prisma.serviceCategory.findFirst({
        where: {
          name: {
            equals: nextName,
            mode: 'insensitive',
          },
          deletedAt: null,
        },
      });

      if (duplicate && duplicate.id !== category.id) {
        throw new ConflictException('Cette categorie existe deja');
      }
    }

    return this.prisma.serviceCategory.update({
      where: { id: category.id },
      data: {
        name: nextName ?? category.name,
        slug: nextName ? toCategorySlug(nextName) : category.slug,
        description:
          command.description !== undefined
            ? command.description.trim() || null
            : category.description,
      },
    });
  }
}

@CommandHandler(DeleteServiceCategoryCommand)
@Injectable()
export class DeleteServiceCategoryHandler implements ICommandHandler<DeleteServiceCategoryCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: DeleteServiceCategoryCommand): Promise<void> {
    const category = await this.prisma.serviceCategory.findFirst({
      where: {
        id: command.categoryId,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new NotFoundException('Categorie non trouvee');
    }

    const attachedServices = await this.prisma.serviceOffering.count({
      where: {
        categoryId: category.id,
        deletedAt: null,
      },
    });

    if (attachedServices > 0) {
      throw new BadRequestException(
        'Impossible de supprimer une categorie associee a des services actifs',
      );
    }

    await this.prisma.serviceCategory.update({
      where: { id: category.id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }
}

@CommandHandler(CreateServiceCategoryRequestCommand)
@Injectable()
export class CreateServiceCategoryRequestHandler implements ICommandHandler<CreateServiceCategoryRequestCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CreateServiceCategoryRequestCommand) {
    const proposedName = command.proposedName.trim();
    if (!proposedName) {
      throw new BadRequestException('Le nom propose est requis');
    }

    const professional = await this.prisma.professional.findFirst({
      where: {
        id: command.professionalId,
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    if (command.requestedBy && command.requestedBy !== professional.userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas soumettre une demande pour ce profil',
      );
    }

    return this.prisma.serviceCategoryRequest.create({
      data: {
        professionalId: command.professionalId,
        proposedName,
        proposedDescription: command.proposedDescription?.trim() || null,
        metadata: command.requestedBy
          ? {
              requestedBy: command.requestedBy,
            }
          : undefined,
      },
    });
  }
}

@CommandHandler(ApproveServiceCategoryRequestCommand)
@Injectable()
export class ApproveServiceCategoryRequestHandler implements ICommandHandler<ApproveServiceCategoryRequestCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ApproveServiceCategoryRequestCommand) {
    const request = await this.prisma.serviceCategoryRequest.findFirst({
      where: {
        id: command.requestId,
        deletedAt: null,
      },
    });

    if (!request) {
      throw new NotFoundException('Demande de categorie non trouvee');
    }

    if (request.status !== ServiceCategoryRequestStatus.PENDING) {
      throw new BadRequestException('Cette demande a deja ete traitee');
    }

    const approvedName =
      command.approvedName?.trim() || request.proposedName.trim();
    if (!approvedName) {
      throw new BadRequestException('Le nom approuve est requis');
    }

    const approvedDescription =
      command.approvedDescription !== undefined
        ? command.approvedDescription.trim() || null
        : request.proposedDescription;

    const existingCategory = await this.prisma.serviceCategory.findFirst({
      where: {
        name: {
          equals: approvedName,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
    });

    let categoryId: string;

    if (existingCategory) {
      categoryId = existingCategory.id;
      if (command.approvedDescription !== undefined) {
        await this.prisma.serviceCategory.update({
          where: { id: existingCategory.id },
          data: {
            description: approvedDescription,
          },
        });
      }
    } else {
      const createdCategory = await this.prisma.serviceCategory.create({
        data: {
          name: approvedName,
          slug: toCategorySlug(approvedName),
          description: approvedDescription,
          metadata: {
            approvedFromRequestId: request.id,
          },
        },
      });
      categoryId = createdCategory.id;
    }

    return this.prisma.serviceCategoryRequest.update({
      where: { id: request.id },
      data: {
        status: ServiceCategoryRequestStatus.APPROVED,
        reviewedByUserId: command.reviewedBy,
        reviewedAt: new Date(),
        approvedCategoryId: categoryId,
      },
      include: {
        approvedCategory: true,
      },
    });
  }
}

@CommandHandler(RejectServiceCategoryRequestCommand)
@Injectable()
export class RejectServiceCategoryRequestHandler implements ICommandHandler<RejectServiceCategoryRequestCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: RejectServiceCategoryRequestCommand) {
    const request = await this.prisma.serviceCategoryRequest.findFirst({
      where: {
        id: command.requestId,
        deletedAt: null,
      },
    });

    if (!request) {
      throw new NotFoundException('Demande de categorie non trouvee');
    }

    if (request.status !== ServiceCategoryRequestStatus.PENDING) {
      throw new BadRequestException('Cette demande a deja ete traitee');
    }

    return this.prisma.serviceCategoryRequest.update({
      where: { id: request.id },
      data: {
        status: ServiceCategoryRequestStatus.REJECTED,
        reviewedByUserId: command.reviewedBy,
        reviewedAt: new Date(),
        reviewNote: command.reviewNote?.trim() || null,
      },
    });
  }
}

/**
 * AddServiceHandler
 * Handles adding a new service to a professional's offerings
 */
@CommandHandler(AddServiceCommand)
@Injectable()
export class AddServiceHandler implements ICommandHandler<AddServiceCommand> {
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly prisma: PrismaService,
    private readonly eligibility: ProfessionalEligibilityService,
  ) {}

  async execute(command: AddServiceCommand): Promise<ServiceOfferingEntity> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const categoryName = command.category.trim();
    if (!categoryName) {
      throw new BadRequestException('Le nom de la categorie est requis');
    }

    const category = await this.prisma.serviceCategory.findFirst({
      where: {
        name: {
          equals: categoryName,
          mode: 'insensitive',
        },
        isActive: true,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new NotFoundException(
        'Categorie introuvable. Choisissez une categorie valide du catalogue global.',
      );
    }

    const service = ServiceOfferingEntity.create({
      id: randomUUID(),
      professionalId: command.professionalId,
      name: command.name,
      description: command.description,
      durationMin: command.durationMin,
      basePrice: command.basePrice,
      category: category.name,
    });

    if (command.imageUrl) {
      service.setImage(command.imageUrl);
    }

    professional.addService(service);
    await this.repository.save(professional);
    await this.eligibility.refresh(professional.userId);

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
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: UpdateServiceCommand): Promise<ServiceOfferingEntity> {
    const serviceRecord = await this.prisma.serviceOffering.findFirst({
      where: { id: command.serviceId, deletedAt: null },
      select: { professionalId: true },
    });

    if (!serviceRecord) {
      throw new NotFoundException('Service non trouve');
    }

    const owner = await this.repository.findById(serviceRecord.professionalId);
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
      const categoryName = command.category.trim();
      if (!categoryName) {
        throw new BadRequestException('Le nom de la categorie est requis');
      }

      const category = await this.prisma.serviceCategory.findFirst({
        where: {
          name: {
            equals: categoryName,
            mode: 'insensitive',
          },
          isActive: true,
          deletedAt: null,
        },
      });

      if (!category) {
        throw new NotFoundException(
          'Categorie introuvable. Choisissez une categorie valide du catalogue global.',
        );
      }

      service.category = category.name;
    }

    if (command.imageUrl !== undefined) {
      service.setImage(command.imageUrl);
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
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly eligibility: ProfessionalEligibilityService,
  ) {}

  async execute(command: DeleteServiceCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    professional.removeService(command.serviceId);
    await this.repository.save(professional);
    await this.eligibility.refresh(professional.userId);
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
      throw new NotFoundException('Professionnel non trouve');
    }

    const service = professional.getService(command.serviceId);
    if (!service) {
      throw new NotFoundException('Service non trouve');
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
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly eligibility: ProfessionalEligibilityService,
  ) {}

  async execute(command: ActivateServiceCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const service = professional.getService(command.serviceId);
    if (!service) {
      throw new NotFoundException('Service non trouve');
    }

    service.activate();
    await this.repository.save(professional);
    await this.eligibility.refresh(professional.userId);
  }
}

/**
 * DeactivateServiceHandler
 * Handles deactivating a service (temporarily hide without deleting)
 */
@CommandHandler(DeactivateServiceCommand)
@Injectable()
export class DeactivateServiceHandler implements ICommandHandler<DeactivateServiceCommand> {
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly prisma: PrismaService,
    private readonly eligibility: ProfessionalEligibilityService,
  ) {}

  async execute(command: DeactivateServiceCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const service = professional.getService(command.serviceId);
    if (!service) {
      throw new NotFoundException('Service non trouve');
    }

    service.deactivate();
    await this.repository.save(professional);

    await this.prisma.booking.updateMany({
      where: {
        serviceId: command.serviceId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        deletedAt: null,
      },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationNote: 'Service désactivé par le professionnel.',
      },
    });

    await this.eligibility.refresh(professional.userId);
  }
}

@CommandHandler(AddServiceImageCommand)
@Injectable()
export class AddServiceImageHandler implements ICommandHandler<AddServiceImageCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: AddServiceImageCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) throw new NotFoundException('Professionnel non trouve');

    const service = professional.getService(command.serviceId);
    if (!service) throw new NotFoundException('Service non trouve');

    service.setImage(command.imageUrl);
    await this.repository.save(professional);
  }
}

@CommandHandler(RemoveServiceImageCommand)
@Injectable()
export class RemoveServiceImageHandler implements ICommandHandler<RemoveServiceImageCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: RemoveServiceImageCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) throw new NotFoundException('Professionnel non trouve');

    const service = professional.getService(command.serviceId);
    if (!service) throw new NotFoundException('Service non trouve');

    service.clearImage();
    await this.repository.save(professional);
  }
}

@CommandHandler(UpsertServicesBulkCommand)
@Injectable()
export class UpsertServicesBulkHandler implements ICommandHandler<UpsertServicesBulkCommand> {
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly prisma: PrismaService,
    private readonly eligibility: ProfessionalEligibilityService,
  ) {}

  async execute(command: UpsertServicesBulkCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) throw new NotFoundException('Professionnel non trouve');

    // Validate all categories up front (batch lookup).
    const categoryNames = [
      ...new Set(command.services.map((s) => s.category.trim())),
    ];
    const foundCategories = await this.prisma.serviceCategory.findMany({
      where: {
        name: { in: categoryNames, mode: 'insensitive' },
        isActive: true,
        deletedAt: null,
      },
      select: { name: true },
    });
    const validNames = new Set(
      foundCategories.map((c) => c.name.toLowerCase()),
    );
    for (const name of categoryNames) {
      if (!validNames.has(name.toLowerCase())) {
        throw new NotFoundException(
          `Categorie introuvable : "${name}". Choisissez une categorie valide du catalogue global.`,
        );
      }
    }

    // Soft-delete services absent from the submitted list.
    const submittedIds = new Set(
      command.services.filter((s) => s.id).map((s) => s.id!),
    );
    for (const existing of professional.services.filter((s) => !s.deletedAt)) {
      if (!submittedIds.has(existing.id)) {
        professional.removeService(existing.id);
      }
    }

    // Upsert each submitted service.
    for (const item of command.services) {
      const resolvedCategory =
        foundCategories.find(
          (c) => c.name.toLowerCase() === item.category.trim().toLowerCase(),
        )?.name ?? item.category.trim();

      if (item.id) {
        const existing = professional.getService(item.id);
        if (existing) {
          // Update in place.
          existing.name = item.name;
          if (item.description !== undefined)
            existing.description = item.description;
          existing.durationMin = item.durationMin;
          existing.basePrice = item.basePrice;
          existing.category = resolvedCategory;
          if (item.imageUrl === null) {
            existing.clearImage();
          } else if (item.imageUrl !== undefined) {
            existing.setImage(item.imageUrl);
          }
          existing.updatedAt = new Date();
        }
        // If id was given but not found (deleted), fall through to create.
        else {
          const service = ServiceOfferingEntity.create({
            id: item.id,
            professionalId: professional.id,
            name: item.name,
            description: item.description,
            durationMin: item.durationMin,
            basePrice: item.basePrice,
            category: resolvedCategory,
          });
          if (item.imageUrl) service.setImage(item.imageUrl);
          professional.addService(service);
        }
      } else {
        // New service — generate a fresh ID.
        const service = ServiceOfferingEntity.create({
          id: randomUUID(),
          professionalId: professional.id,
          name: item.name,
          description: item.description,
          durationMin: item.durationMin,
          basePrice: item.basePrice,
          category: resolvedCategory,
        });
        if (item.imageUrl) service.setImage(item.imageUrl);
        professional.addService(service);
      }
    }

    await this.repository.save(professional);
    await this.eligibility.refresh(professional.userId);
  }
}

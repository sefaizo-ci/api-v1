import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../libs/database/prisma.service';
import { ServiceOfferingEntity } from '../../core/entities/service-offering.entity';
import { ProfessionalRepository } from '../../infrastructure/persistence/professional.repository';
import {
  ActivateServiceCommand,
  AddServiceCommand,
  CreateServiceCategoryCommand,
  DeactivateServiceCommand,
  DeleteServiceCategoryCommand,
  DeleteServiceCommand,
  SetServiceCommuneFeeCommand,
  UpdateServiceCategoryCommand,
  UpdateServiceCommand,
} from '../../interface/commands';

type ProfessionalOwnerRecord = {
  id: string;
  userId: string;
};

type ServiceCategoryRecord = {
  id: string;
  professionalId: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

type ServiceCategoryCreateData = {
  professionalId: string;
  name: string;
  description?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type ProfessionalCategoryPrisma = {
  professional: {
    findFirst(args: {
      where: {
        id: string;
        deletedAt: null;
      };
      select: {
        id: true;
        userId: true;
      };
    }): Promise<ProfessionalOwnerRecord | null>;
  };
  serviceCategory: {
    findFirst(args: {
      where: {
        professionalId: string;
        name: {
          equals: string;
          mode: 'insensitive';
        };
        deletedAt: null;
        isActive?: boolean;
      };
    }): Promise<ServiceCategoryRecord | null>;
    create(args: {
      data: ServiceCategoryCreateData;
    }): Promise<ServiceCategoryRecord>;
    update(args: {
      where: {
        id: string;
      };
      data: {
        name?: string;
        description?: string | null;
        isActive?: boolean;
        deletedAt?: Date | null;
        metadata?: Prisma.InputJsonValue;
      };
    }): Promise<ServiceCategoryRecord>;
    updateMany(args: {
      where: {
        categoryId: string;
      };
      data: {
        categoryId: string;
      };
    }): Promise<{ count: number }>;
  };
  serviceOffering: {
    updateMany(args: {
      where: {
        categoryId: string;
      };
      data: {
        categoryId: string;
      };
    }): Promise<{ count: number }>;
  };
};

function toPrismaFacade(
  prisma: PrismaService,
): PrismaService & ProfessionalCategoryPrisma {
  return prisma as PrismaService & ProfessionalCategoryPrisma;
}

const DEFAULT_CATEGORY_NAME = 'Sans catégorie';

async function ensureDefaultCategory(
  prisma: PrismaService & ProfessionalCategoryPrisma,
  professionalId: string,
): Promise<ServiceCategoryRecord> {
  const existing = await prisma.serviceCategory.findFirst({
    where: {
      professionalId,
      name: {
        equals: DEFAULT_CATEGORY_NAME,
        mode: 'insensitive',
      },
      deletedAt: null,
      isActive: true,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.serviceCategory.create({
    data: {
      professionalId,
      name: DEFAULT_CATEGORY_NAME,
      description: 'Catégorie par défaut',
      metadata: {
        defaultCategory: true,
      },
    },
  });
}

@CommandHandler(CreateServiceCategoryCommand)
@Injectable()
export class CreateServiceCategoryHandler implements ICommandHandler<CreateServiceCategoryCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: CreateServiceCategoryCommand,
  ): Promise<ServiceCategoryRecord> {
    const prisma = toPrismaFacade(this.prisma);
    const categoryName = command.name.trim();
    if (!categoryName) {
      throw new BadRequestException('Le nom de la categorie est requis');
    }

    const professional = await prisma.professional.findFirst({
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

    if (command.createdBy && professional.userId !== command.createdBy) {
      throw new ForbiddenException(
        'Vous ne pouvez pas creer une categorie pour ce profil',
      );
    }

    const existing = await prisma.serviceCategory.findFirst({
      where: {
        professionalId: command.professionalId,
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

    const created = await prisma.serviceCategory.create({
      data: {
        professionalId: command.professionalId,
        name: categoryName,
        description: command.description?.trim() || null,
        metadata: command.createdBy
          ? {
              createdBy: command.createdBy,
            }
          : undefined,
      },
    });

    return created;
  }
}

@CommandHandler(UpdateServiceCategoryCommand)
@Injectable()
export class UpdateServiceCategoryHandler implements ICommandHandler<UpdateServiceCategoryCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: UpdateServiceCategoryCommand,
  ): Promise<ServiceCategoryRecord> {
    const prisma = toPrismaFacade(this.prisma);
    const category = await prisma.serviceCategory.findFirst({
      where: {
        id: command.categoryId,
        professionalId: command.professionalId,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new NotFoundException('Categorie non trouvee');
    }

    const professional = await prisma.professional.findFirst({
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

    if (command.updatedBy && professional.userId !== command.updatedBy) {
      throw new ForbiddenException(
        'Vous ne pouvez pas modifier une categorie pour ce profil',
      );
    }

    if (category.name.toLowerCase() === DEFAULT_CATEGORY_NAME.toLowerCase()) {
      throw new BadRequestException(
        'La categorie par defaut ne peut pas etre modifiee',
      );
    }

    const nextName = command.name?.trim();
    if (nextName) {
      const duplicate = await prisma.serviceCategory.findFirst({
        where: {
          professionalId: command.professionalId,
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

    return prisma.serviceCategory.update({
      where: { id: category.id },
      data: {
        name: nextName ?? category.name,
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
    const prisma = toPrismaFacade(this.prisma);
    const category = await prisma.serviceCategory.findFirst({
      where: {
        id: command.categoryId,
        professionalId: command.professionalId,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new NotFoundException('Categorie non trouvee');
    }

    const professional = await prisma.professional.findFirst({
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

    if (command.deletedBy && professional.userId !== command.deletedBy) {
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer une categorie pour ce profil',
      );
    }

    if (category.name.toLowerCase() === DEFAULT_CATEGORY_NAME.toLowerCase()) {
      throw new BadRequestException(
        'La categorie par defaut ne peut pas etre supprimee',
      );
    }

    const defaultCategory = await ensureDefaultCategory(
      prisma,
      command.professionalId,
    );

    await prisma.$transaction([
      prisma.serviceOffering.updateMany({
        where: { categoryId: category.id },
        data: { categoryId: defaultCategory.id },
      }),
      prisma.serviceCategory.update({
        where: { id: category.id },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      }),
    ]);
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
  ) {}

  async execute(command: AddServiceCommand): Promise<ServiceOfferingEntity> {
    const prisma = toPrismaFacade(this.prisma);
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouvé');
    }

    const categoryName = command.category.trim();
    if (!categoryName) {
      throw new BadRequestException('Le nom de la categorie est requis');
    }

    let category = await prisma.serviceCategory.findFirst({
      where: {
        professionalId: command.professionalId,
        name: {
          equals: categoryName,
          mode: 'insensitive',
        },
        isActive: true,
        deletedAt: null,
      },
    });

    if (!category) {
      category = await prisma.serviceCategory.create({
        data: {
          professionalId: command.professionalId,
          name: categoryName,
          metadata: {
            autoCreatedByService: true,
          },
        },
      });
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
  constructor(
    private readonly repository: ProfessionalRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: UpdateServiceCommand): Promise<ServiceOfferingEntity> {
    const prisma = toPrismaFacade(this.prisma);
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
      const categoryName = command.category.trim();
      if (!categoryName) {
        throw new BadRequestException('Le nom de la categorie est requis');
      }

      let category = await prisma.serviceCategory.findFirst({
        where: {
          professionalId: owner.id,
          name: {
            equals: categoryName,
            mode: 'insensitive',
          },
          isActive: true,
          deletedAt: null,
        },
      });

      if (!category) {
        category = await prisma.serviceCategory.create({
          data: {
            professionalId: owner.id,
            name: categoryName,
            metadata: {
              autoCreatedByService: true,
            },
          },
        });
      }

      service.category = category.name;
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

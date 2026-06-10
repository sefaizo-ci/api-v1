import { Injectable } from '@nestjs/common';
import { NotFoundException } from '../../../../libs/exceptions/domain.exceptions';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { GalleryItemEntity } from '../../core/entities/gallery-item.entity';
import { ProfessionalRepository } from '../../infrastructure/persistence/professional.repository';
import {
  DeleteGalleryItemCommand,
  PublishGalleryItemCommand,
  ReplaceGalleryCommand,
  ReorderGalleryCommand,
  UnpublishGalleryItemCommand,
  UpdateGalleryItemCommand,
  UploadGalleryItemCommand,
} from '../../interface/commands';

@CommandHandler(UploadGalleryItemCommand)
@Injectable()
export class UploadGalleryItemHandler implements ICommandHandler<UploadGalleryItemCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: UploadGalleryItemCommand): Promise<GalleryItemEntity> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const item = GalleryItemEntity.create({
      id: randomUUID(),
      professionalId: professional.id,
      imageUrl: command.imageUrl,
      caption: command.caption,
      category: command.category,
      order: professional.getAllGalleryItems().length,
    });

    professional.addGalleryItem(item);
    await this.repository.save(professional);

    return item;
  }
}

@CommandHandler(UpdateGalleryItemCommand)
@Injectable()
export class UpdateGalleryItemHandler implements ICommandHandler<UpdateGalleryItemCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: UpdateGalleryItemCommand): Promise<GalleryItemEntity> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const item = professional.gallery.find(
      (g) => g.id === command.itemId && !g.deletedAt,
    );
    if (!item) {
      throw new NotFoundException('Element galerie non trouve');
    }

    item.update({
      caption: command.caption,
      category: command.category,
    });

    await this.repository.save(professional);
    return item;
  }
}

@CommandHandler(DeleteGalleryItemCommand)
@Injectable()
export class DeleteGalleryItemHandler implements ICommandHandler<DeleteGalleryItemCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: DeleteGalleryItemCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    professional.removeGalleryItem(command.itemId);
    await this.repository.save(professional);
  }
}

@CommandHandler(PublishGalleryItemCommand)
@Injectable()
export class PublishGalleryItemHandler implements ICommandHandler<PublishGalleryItemCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: PublishGalleryItemCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const item = professional.gallery.find(
      (g) => g.id === command.itemId && !g.deletedAt,
    );
    if (!item) {
      throw new NotFoundException('Element galerie non trouve');
    }

    item.makePublic();
    await this.repository.save(professional);
  }
}

@CommandHandler(UnpublishGalleryItemCommand)
@Injectable()
export class UnpublishGalleryItemHandler implements ICommandHandler<UnpublishGalleryItemCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: UnpublishGalleryItemCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const item = professional.gallery.find(
      (g) => g.id === command.itemId && !g.deletedAt,
    );
    if (!item) {
      throw new NotFoundException('Element galerie non trouve');
    }

    item.makePrivate();
    await this.repository.save(professional);
  }
}

@CommandHandler(ReorderGalleryCommand)
@Injectable()
export class ReorderGalleryHandler implements ICommandHandler<ReorderGalleryCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: ReorderGalleryCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    professional.reorderGallery(command.itemOrders);
    await this.repository.save(professional);
  }
}

@CommandHandler(ReplaceGalleryCommand)
@Injectable()
export class ReplaceGalleryHandler implements ICommandHandler<ReplaceGalleryCommand> {
  constructor(private readonly repository: ProfessionalRepository) {}

  async execute(command: ReplaceGalleryCommand): Promise<void> {
    const professional = await this.repository.findById(command.professionalId);
    if (!professional) {
      throw new NotFoundException('Professionnel non trouve');
    }

    const keepSet = new Set(command.keepIds);
    for (const item of professional.gallery.filter((g) => !g.deletedAt)) {
      if (!keepSet.has(item.id)) {
        professional.removeGalleryItem(item.id);
      }
    }

    await this.repository.save(professional);
  }
}

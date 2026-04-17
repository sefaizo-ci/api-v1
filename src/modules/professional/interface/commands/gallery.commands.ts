import { ICommand } from '@nestjs/cqrs';

/**
 * UploadGalleryItemCommand
 * Command to upload/add a gallery item to professional's portfolio
 */
export class UploadGalleryItemCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly imageUrl: string,
    public readonly caption?: string,
    public readonly category?: string,
  ) {}
}

/**
 * UpdateGalleryItemCommand
 * Command to update gallery item details
 */
export class UpdateGalleryItemCommand implements ICommand {
  constructor(
    public readonly itemId: string,
    public readonly professionalId: string,
    public readonly caption?: string,
    public readonly category?: string,
  ) {}
}

/**
 * DeleteGalleryItemCommand
 * Command to delete/remove a gallery item
 */
export class DeleteGalleryItemCommand implements ICommand {
  constructor(
    public readonly itemId: string,
    public readonly professionalId: string,
  ) {}
}

/**
 * PublishGalleryItemCommand
 * Command to make gallery item public/visible
 */
export class PublishGalleryItemCommand implements ICommand {
  constructor(
    public readonly itemId: string,
    public readonly professionalId: string,
  ) {}
}

/**
 * UnpublishGalleryItemCommand
 * Command to hide gallery item (make private)
 */
export class UnpublishGalleryItemCommand implements ICommand {
  constructor(
    public readonly itemId: string,
    public readonly professionalId: string,
  ) {}
}

/**
 * ReorderGalleryCommand
 * Command to reorder gallery items
 */
export class ReorderGalleryCommand implements ICommand {
  constructor(
    public readonly professionalId: string,
    public readonly itemOrders: { id: string; order: number }[],
  ) {}
}

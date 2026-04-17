/**
 * GalleryItem Entity
 * Represents a portfolio item (image) for a professional
 */
export class GalleryItemEntity {
  id: string;
  professionalId: string;
  imageUrl: string;
  caption?: string;
  category?: string;
  order: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  constructor(props: {
    id: string;
    professionalId: string;
    imageUrl: string;
    caption?: string;
    category?: string;
    order?: number;
    isPublic?: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
  }) {
    this.id = props.id;
    this.professionalId = props.professionalId;
    this.imageUrl = props.imageUrl;
    this.caption = props.caption;
    this.category = props.category;
    this.order = props.order ?? 0;
    this.isPublic = props.isPublic ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: {
    id: string;
    professionalId: string;
    imageUrl: string;
    caption?: string;
    category?: string;
    order?: number;
  }): GalleryItemEntity {
    if (!props.imageUrl || props.imageUrl.trim().length === 0) {
      throw new Error('Image URL is required');
    }

    return new GalleryItemEntity({
      ...props,
      id: props.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Update gallery item details
   */
  update(props: { caption?: string; category?: string; order?: number }): void {
    if (props.caption !== undefined) this.caption = props.caption;
    if (props.category !== undefined) this.category = props.category;
    if (props.order !== undefined) this.order = props.order;
    this.updatedAt = new Date();
  }

  /**
   * Make item public
   */
  makePublic(): void {
    this.isPublic = true;
    this.updatedAt = new Date();
  }

  /**
   * Make item private
   */
  makePrivate(): void {
    this.isPublic = false;
    this.updatedAt = new Date();
  }

  /**
   * Check if item is visible (not deleted and public)
   */
  isVisible(): boolean {
    return !this.deletedAt && this.isPublic;
  }

  /**
   * Soft delete
   */
  delete(): void {
    this.deletedAt = new Date();
  }

  /**
   * Restore from soft delete
   */
  restore(): void {
    this.deletedAt = undefined;
    this.updatedAt = new Date();
  }
}

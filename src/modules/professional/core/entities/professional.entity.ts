import { ProfessionalStatus, ServiceLocation } from '../enums';
import { AvailabilityEntity } from './availability.entity';
import { GalleryItemEntity } from './gallery-item.entity';
import { ServiceOfferingEntity } from './service-offering.entity';

/**
 * Professional Aggregate Root
 * Represents a professional user with their complete business profile
 * Key constraint: One user = One professional = One business/agency
 */
export class ProfessionalEntity {
  id: string;
  userId: string;

  // Profile
  agencyName: string;
  bio?: string;
  avatarUrl?: string;
  location: ServiceLocation;
  address?: string;
  latitude?: number;
  longitude?: number;

  // Status
  status: ProfessionalStatus;
  isVerified: boolean;
  rejectionReason?: string;
  isListingActive: boolean;
  isAcceptingBookings: boolean = true;
  bookingsPausedUntil?: Date;

  // Ratings
  rating: number = 0;
  reviewCount: number = 0;

  // Collections
  services: ServiceOfferingEntity[] = [];
  availabilities: AvailabilityEntity[] = [];
  gallery: GalleryItemEntity[] = [];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  constructor(props: {
    id: string;
    userId: string;
    agencyName: string;
    bio?: string;
    avatarUrl?: string;
    location?: ServiceLocation;
    address?: string;
    latitude?: number;
    longitude?: number;
    status?: ProfessionalStatus;
    isVerified?: boolean;
    rejectionReason?: string;
    isListingActive?: boolean;
    isAcceptingBookings?: boolean;
    bookingsPausedUntil?: Date;
    rating?: number;
    reviewCount?: number;
    services?: ServiceOfferingEntity[];
    availabilities?: AvailabilityEntity[];
    gallery?: GalleryItemEntity[];
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
  }) {
    this.id = props.id;
    this.userId = props.userId;
    this.agencyName = props.agencyName;
    this.bio = props.bio;
    this.avatarUrl = props.avatarUrl;
    this.location = props.location ?? ServiceLocation.BOTH;
    this.address = props.address;
    this.latitude = props.latitude;
    this.longitude = props.longitude;
    this.status = props.status ?? ProfessionalStatus.PENDING;
    this.isVerified = props.isVerified ?? false;
    this.rejectionReason = props.rejectionReason;
    this.isListingActive = props.isListingActive ?? true;
    this.isAcceptingBookings = props.isAcceptingBookings ?? true;
    this.bookingsPausedUntil = props.bookingsPausedUntil;
    this.rating = props.rating ?? 0;
    this.reviewCount = props.reviewCount ?? 0;
    this.services = props.services ?? [];
    this.availabilities = props.availabilities ?? [];
    this.gallery = props.gallery ?? [];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  /**
   * Factory method: Create new professional profile
   * Status starts as PENDING until verified
   */
  static create(props: {
    id: string;
    userId: string;
    agencyName: string;
    bio?: string;
    avatarUrl?: string;
    location?: ServiceLocation;
    address?: string;
    latitude?: number;
    longitude?: number;
  }): ProfessionalEntity {
    if (!props.agencyName || props.agencyName.trim().length === 0) {
      throw new Error('Agency name is required');
    }

    return new ProfessionalEntity({
      ...props,
      id: props.id,
      status: ProfessionalStatus.PENDING,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Update professional profile information
   */
  updateProfile(props: {
    agencyName?: string;
    bio?: string;
    avatarUrl?: string;
    location?: ServiceLocation;
    address?: string;
    latitude?: number;
    longitude?: number;
  }): void {
    if (
      props.agencyName !== undefined &&
      props.agencyName.trim().length === 0
    ) {
      throw new Error('Agency name cannot be empty');
    }

    if (props.agencyName) this.agencyName = props.agencyName;
    if (props.bio !== undefined) this.bio = props.bio;
    if (props.avatarUrl !== undefined) this.avatarUrl = props.avatarUrl;
    if (props.location) this.location = props.location;
    if (props.address !== undefined) this.address = props.address;
    if (props.latitude !== undefined) this.latitude = props.latitude;
    if (props.longitude !== undefined) this.longitude = props.longitude;

    this.updatedAt = new Date();
  }

  /**
   * Verify professional profile (by admin/system)
   */
  verify(): void {
    if (this.isVerified) {
      return;
    }
    this.isVerified = true;
    this.status = ProfessionalStatus.ACTIVE;
    this.rejectionReason = undefined;
    this.updatedAt = new Date();
  }

  /**
   * Reject professional profile (by admin), with a mandatory reason
   */
  reject(reason: string): void {
    if (this.isVerified) {
      throw new Error('Cannot reject an already verified professional');
    }
    this.status = ProfessionalStatus.REJECTED;
    this.rejectionReason = reason;
    this.updatedAt = new Date();
  }

  resubmit(): void {
    if (this.status !== ProfessionalStatus.REJECTED) {
      throw new Error('Only rejected professionals can resubmit');
    }
    this.status = ProfessionalStatus.PENDING;
    this.rejectionReason = undefined;
    this.updatedAt = new Date();
  }

  /**
   * Suspend professional (due to violations, etc.)
   */
  suspend(): void {
    this.status = ProfessionalStatus.SUSPENDED;
    this.updatedAt = new Date();
  }

  /**
   * Reactivate suspended professional
   */
  reactivate(): void {
    if (!this.isVerified) {
      throw new Error('Cannot reactivate unverified professional');
    }
    this.status = ProfessionalStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Activate the public listing (pro-controlled toggle)
   */
  activateListing(): void {
    this.isListingActive = true;
    this.updatedAt = new Date();
  }

  /**
   * Deactivate the public listing (pro-controlled toggle)
   */
  deactivateListing(): void {
    this.isListingActive = false;
    this.updatedAt = new Date();
  }

  /**
   * Pause new bookings until an optional date (pro-controlled).
   * If no date is given, the pause is indefinite.
   */
  pauseBookings(resumeAt?: Date): void {
    this.isAcceptingBookings = false;
    this.bookingsPausedUntil = resumeAt;
    this.updatedAt = new Date();
  }

  /**
   * Resume bookings immediately and clear the scheduled resume date.
   */
  resumeBookings(): void {
    this.isAcceptingBookings = true;
    this.bookingsPausedUntil = undefined;
    this.updatedAt = new Date();
  }

  /**
   * Whether the professional appears in public discovery lists.
   * Admin gate: ACTIVE + verified.
   * Pro gate: isListingActive + at least 1 service.
   */
  isPubliclyVisible(): boolean {
    return (
      this.isVerified &&
      this.status === ProfessionalStatus.ACTIVE &&
      !this.deletedAt &&
      this.isListingActive &&
      this.hasServices()
    );
  }

  /**
   * Whether the professional can accept new bookings.
   * Requires public visibility + isAcceptingBookings + at least 1 availability.
   */
  canAcceptBookings(): boolean {
    return (
      this.isPubliclyVisible() &&
      this.isAcceptingBookings &&
      this.hasAvailability()
    );
  }

  /**
   * Check if professional is active and not deleted
   */
  isActive(): boolean {
    return !this.deletedAt && this.status !== ProfessionalStatus.SUSPENDED;
  }

  /**
   * Add a new service offering
   */
  addService(service: ServiceOfferingEntity): void {
    if (this.services.some((s) => s.name === service.name && !s.deletedAt)) {
      throw new Error(`Service "${service.name}" already exists`);
    }
    service.professionalId = this.id;
    this.services.push(service);
    this.updatedAt = new Date();
  }

  /**
   * Remove a service offering
   */
  removeService(serviceId: string): void {
    const service = this.services.find((s) => s.id === serviceId);
    if (!service) {
      throw new Error('Service not found');
    }
    service.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Get active services
   */
  getActiveServices(): ServiceOfferingEntity[] {
    return this.services.filter((s) => s.isActive && !s.deletedAt);
  }

  /**
   * Check if professional has at least one service
   */
  hasServices(): boolean {
    return this.getActiveServices().length > 0;
  }

  /**
   * Get service by ID
   */
  getService(serviceId: string): ServiceOfferingEntity | undefined {
    return this.services.find((s) => s.id === serviceId && !s.deletedAt);
  }

  /**
   * Add availability for a day of week
   */
  addAvailability(availability: AvailabilityEntity): void {
    const dayOfWeekExists = this.availabilities.some(
      (a) => a.dayOfWeek === availability.dayOfWeek && !a.deletedAt,
    );
    if (dayOfWeekExists) {
      throw new Error(
        `Availability for day ${availability.dayOfWeek} already exists`,
      );
    }
    availability.professionalId = this.id;
    this.availabilities.push(availability);
    this.updatedAt = new Date();
  }

  /**
   * Update availability for a day of week
   */
  updateAvailability(
    dayOfWeek: number,
    availability: AvailabilityEntity,
  ): void {
    const existing = this.availabilities.find(
      (a) => a.dayOfWeek === dayOfWeek && !a.deletedAt,
    );
    if (!existing) {
      throw new Error(`No availability found for day ${dayOfWeek}`);
    }
    Object.assign(existing, availability);
    this.updatedAt = new Date();
  }

  /**
   * Remove availability for a day
   */
  removeAvailability(dayOfWeek: number): void {
    const availability = this.availabilities.find(
      (a) => a.dayOfWeek === dayOfWeek && !a.deletedAt,
    );
    if (!availability) {
      throw new Error(`No availability found for day ${dayOfWeek}`);
    }
    availability.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Get availability for a specific day
   */
  getAvailability(dayOfWeek: number): AvailabilityEntity | undefined {
    return this.availabilities.find(
      (a) => a.dayOfWeek === dayOfWeek && !a.deletedAt,
    );
  }

  /**
   * Get all active availabilities
   */
  getActiveAvailabilities(): AvailabilityEntity[] {
    return this.availabilities.filter((a) => a.isActive && !a.deletedAt);
  }

  /**
   * Check if professional has availability set up
   */
  hasAvailability(): boolean {
    return this.getActiveAvailabilities().length > 0;
  }

  /**
   * Add gallery item to portfolio
   */
  addGalleryItem(item: GalleryItemEntity): void {
    item.professionalId = this.id;
    this.gallery.push(item);
    this.updatedAt = new Date();
  }

  /**
   * Remove gallery item
   */
  removeGalleryItem(itemId: string): void {
    const item = this.gallery.find((g) => g.id === itemId);
    if (!item) {
      throw new Error('Gallery item not found');
    }
    item.delete();
    this.updatedAt = new Date();
  }

  /**
   * Get public gallery items
   */
  getPublicGallery(): GalleryItemEntity[] {
    return this.gallery
      .filter((g) => g.isPublic && !g.deletedAt)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get all gallery items (including private)
   */
  getAllGalleryItems(): GalleryItemEntity[] {
    return this.gallery
      .filter((g) => !g.deletedAt)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get gallery item count
   */
  getGalleryItemCount(): number {
    return this.getPublicGallery().length;
  }

  /**
   * Reorder gallery items
   */
  reorderGallery(itemOrders: { id: string; order: number }[]): void {
    itemOrders.forEach(({ id, order }) => {
      const item = this.gallery.find((g) => g.id === id);
      if (item) {
        item.order = order;
      }
    });
    this.updatedAt = new Date();
  }

  /**
   * Update rating after new review
   */
  updateRating(newRating: number, reviewCount: number): void {
    if (newRating < 1 || newRating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    this.rating = newRating;
    this.reviewCount = reviewCount;
    this.updatedAt = new Date();
  }

  /**
   * Soft delete professional profile
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

  /**
   * Get profile completeness percentage
   */
  getProfileCompletion(): number {
    let completion = 0;
    const totalFields = 8;

    if (this.agencyName) completion += 1;
    if (this.bio) completion += 1;
    if (this.avatarUrl) completion += 1;
    if (this.address) completion += 1;
    if (this.latitude && this.longitude) completion += 1;
    if (this.getActiveServices().length > 0) completion += 1;
    if (this.getActiveAvailabilities().length > 0) completion += 1;
    if (this.getPublicGallery().length > 0) completion += 1;

    return Math.round((completion / totalFields) * 100);
  }

  /**
   * Get a summary of professional profile for display
   */
  getSummary() {
    const activeServices = this.getActiveServices();
    const minPrice =
      activeServices.length > 0
        ? Math.min(...activeServices.map((s) => s.basePrice))
        : null;
    return {
      id: this.id,
      agencyName: this.agencyName,
      bio: this.bio,
      avatarUrl: this.avatarUrl,
      address: this.address,
      location: this.location,
      status: this.status,
      isVerified: this.isVerified,
      rejectionReason: this.rejectionReason,
      isListingActive: this.isListingActive,
      isAcceptingBookings: this.isAcceptingBookings,
      bookingsPausedUntil: this.bookingsPausedUntil,
      isPubliclyVisible: this.isPubliclyVisible(),
      rating: this.rating,
      reviewCount: this.reviewCount,
      minPrice,
      serviceCount: activeServices.length,
      availabilityCount: this.getActiveAvailabilities().length,
      galleryCount: this.getGalleryItemCount(),
      profileCompletion: this.getProfileCompletion(),
      canAcceptBookings: this.canAcceptBookings(),
    };
  }
}

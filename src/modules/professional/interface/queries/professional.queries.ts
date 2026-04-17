import { IQuery } from '@nestjs/cqrs';

/**
 * GetMyProfessionalProfileQuery
 * Query to retrieve the authenticated user's professional profile
 */
export class GetMyProfessionalProfileQuery implements IQuery {
  constructor(public readonly userId: string) {}
}

/**
 * GetProfessionalProfileQuery
 * Query to retrieve a specific professional profile by ID
 * (public data, available for clients to view)
 */
export class GetProfessionalProfileQuery implements IQuery {
  constructor(public readonly professionalId: string) {}
}

/**
 * ListProfessionalsQuery
 * Query to list professionals with optional filters
 */
export class ListProfessionalsQuery implements IQuery {
  constructor(
    public readonly filters?: {
      status?: string;
      isVerified?: boolean;
      location?: string;
      search?: string;
    },
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}

/**
 * GetProfessionalServicesQuery
 * Query to get services offered by a professional
 */
export class GetProfessionalServicesQuery implements IQuery {
  constructor(
    public readonly professionalId: string,
    public readonly includeInactive?: boolean,
  ) {}
}

/**
 * GetProfessionalAvailabilityQuery
 * Query to get availability schedule of a professional
 */
export class GetProfessionalAvailabilityQuery implements IQuery {
  constructor(
    public readonly professionalId: string,
    public readonly dayOfWeek?: number,
  ) {}
}

/**
 * GetProfessionalGalleryQuery
 * Query to get gallery/portfolio items of a professional
 */
export class GetProfessionalGalleryQuery implements IQuery {
  constructor(
    public readonly professionalId: string,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}

/**
 * GetProfessionalBookingsQuery
 * Query to get bookings for a professional (pro-side)
 */
export class GetProfessionalBookingsQuery implements IQuery {
  constructor(
    public readonly professionalId: string,
    public readonly status?: string,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}

/**
 * GetProfileCompletionQuery
 * Query to get professional profile completion percentage
 */
export class GetProfileCompletionQuery implements IQuery {
  constructor(public readonly professionalId: string) {}
}

/**
 * SearchProfessionalsQuery
 * Query to search professionals by various criteria
 */
export class SearchProfessionalsQuery implements IQuery {
  constructor(
    public readonly search: string,
    public readonly location?: string,
    public readonly rating?: number,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}

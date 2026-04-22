import { IQuery } from '@nestjs/cqrs';

export class GetMyProfessionalProfileQuery implements IQuery {
  constructor(public readonly userId: string) {}
}

export class GetProfessionalProfileQuery implements IQuery {
  constructor(public readonly professionalId: string) {}
}

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

export class GetProfessionalServicesQuery implements IQuery {
  constructor(
    public readonly professionalId: string,
    public readonly includeInactive?: boolean,
  ) {}
}

export class GetProfessionalAvailabilityQuery implements IQuery {
  constructor(
    public readonly professionalId: string,
    public readonly dayOfWeek?: number,
  ) {}
}

export class GetProfessionalGalleryQuery implements IQuery {
  constructor(
    public readonly professionalId: string,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}

export class GetProfessionalBookingsQuery implements IQuery {
  constructor(
    public readonly professionalId: string,
    public readonly status?: string,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}

export class GetProfileCompletionQuery implements IQuery {
  constructor(public readonly professionalId: string) {}
}

export class SearchProfessionalsQuery implements IQuery {
  constructor(
    public readonly search: string,
    public readonly location?: string,
    public readonly rating?: number,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}

export class ListServiceCategoriesQuery implements IQuery {
  constructor(public readonly professionalId: string) {}
}

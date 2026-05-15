import { IQuery } from '@nestjs/cqrs';

export class GetProfessionalReviewsQuery implements IQuery {
  constructor(
    public readonly professionalId: string,
    public readonly page: number = 1,
    public readonly limit: number = 20,
  ) {}
}

export class GetClientReviewsQuery implements IQuery {
  constructor(
    public readonly clientId: string,
    public readonly requestingProfessionalId: string,
  ) {}
}

export class GetMyReviewSessionsQuery implements IQuery {
  constructor(public readonly userId: string) {}
}

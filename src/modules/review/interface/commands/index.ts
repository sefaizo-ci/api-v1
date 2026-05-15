import { ICommand } from '@nestjs/cqrs';

export class SubmitReviewCommand implements ICommand {
  constructor(
    public readonly bookingId: string,
    public readonly reviewerId: string,
    public readonly rating: number,
    public readonly comment?: string,
  ) {}
}

export class EditReviewCommand implements ICommand {
  constructor(
    public readonly reviewId: string,
    public readonly reviewerId: string,
    public readonly rating: number,
    public readonly comment?: string,
  ) {}
}

import { IQuery } from '@nestjs/cqrs';

export class GetOnboardingMetaQuery implements IQuery {
  constructor(
    public readonly userId: string,
    public readonly role: string,
  ) {}
}

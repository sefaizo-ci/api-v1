import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { GetOnboardingMetaQuery } from './get-onboarding-meta.query';

@QueryHandler(GetOnboardingMetaQuery)
export class GetOnboardingMetaHandler implements IQueryHandler<GetOnboardingMetaQuery> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async execute(query: GetOnboardingMetaQuery) {
    return this.userRepo.getOnboardingMeta(query.userId, query.role);
  }
}

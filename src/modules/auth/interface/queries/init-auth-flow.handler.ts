import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { InitAuthFlowQuery } from './init-auth-flow.query';

type InitAuthFlowResponse = {
  hasAccount: boolean;
  nextStep: 'PIN_THEN_OTP' | 'OTP';
};

@QueryHandler(InitAuthFlowQuery)
export class InitAuthFlowHandler implements IQueryHandler<InitAuthFlowQuery> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async execute(query: InitAuthFlowQuery): Promise<InitAuthFlowResponse> {
    const user = await this.userRepo.findByPhone(query.phone);

    const hasAccount = !!(user && user.hasPin() && user.isAccountActive());

    return {
      hasAccount,
      nextStep: hasAccount ? 'PIN_THEN_OTP' : 'OTP',
    };
  }
}

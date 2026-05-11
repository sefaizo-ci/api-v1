import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { InitAuthFlowQuery } from './init-auth-flow.query';

type InitAuthFlowResponse = {
  nextStep: 'PIN_THEN_OTP' | 'OTP';
};

@QueryHandler(InitAuthFlowQuery)
export class InitAuthFlowHandler implements IQueryHandler<InitAuthFlowQuery> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async execute(query: InitAuthFlowQuery): Promise<InitAuthFlowResponse> {
    const phone = await this.userRepo.findPhoneByNumber(query.phone);
    if (!phone) return { nextStep: 'OTP' };

    const app = query.app ?? 'CLIENT';
    const userId =
      app === 'PROFESSIONAL' ? phone.professionalUserId : phone.clientUserId;
    if (!userId) return { nextStep: 'OTP' };

    const user = await this.userRepo.findById(userId);
    if (!user) return { nextStep: 'OTP' };

    const hasPin = user.hasPin && user.hasPin();
    const isActive = user.isAccountActive && user.isAccountActive();
    if (!hasPin || !isActive) return { nextStep: 'OTP' };

    return { nextStep: 'PIN_THEN_OTP' };
  }
}

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { AcceptTermsCommand } from '../commands/accept-terms.command';

@CommandHandler(AcceptTermsCommand)
export class AcceptTermsHandler implements ICommandHandler<AcceptTermsCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async execute(cmd: AcceptTermsCommand): Promise<{ acceptedTermsAt: string }> {
    await this.userRepo.acceptTerms(cmd.userId);
    return { acceptedTermsAt: new Date().toISOString() };
  }
}

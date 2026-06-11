import { Inject } from '@nestjs/common';
import { NotFoundException } from '../../../../libs/exceptions/domain.exceptions';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { GetMeQuery } from './get-me.query';

@QueryHandler(GetMeQuery)
export class GetMeHandler implements IQueryHandler<GetMeQuery> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async execute(query: GetMeQuery) {
    const user = await this.userRepo.findById(query.userId);
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    // Mirror the auth-token payloads (login/complete, pin/create): expose the
    // professional aggregate id so a client resuming a session doesn't mistake
    // the user id for the professionalId.
    const professionalId =
      user.role === 'PROFESSIONAL'
        ? await this.userRepo.getProfessionalId(user.id)
        : null;
    const clientId = user.role === 'CLIENT' ? user.id : null;

    return {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isVerified: user.isVerified,
      professionalId,
      clientId,
    };
  }
}

import { Inject, NotFoundException } from '@nestjs/common';
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
    return {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isVerified: user.isVerified,
    };
  }
}

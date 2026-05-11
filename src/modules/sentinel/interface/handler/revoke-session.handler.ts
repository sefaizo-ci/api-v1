import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { IRefreshTokenRepository } from '../../core/services/refresh-token.service.interface';
import { RevokeSessionCommand } from '../commands/revoke-session.command';

@CommandHandler(RevokeSessionCommand)
export class RevokeSessionHandler implements ICommandHandler<RevokeSessionCommand> {
  constructor(
    @Inject('IRefreshTokenRepository')
    private readonly refreshRepo: IRefreshTokenRepository,
  ) {}

  async execute(cmd: RevokeSessionCommand): Promise<{ message: string }> {
    const token = await this.refreshRepo.findById(cmd.sessionId);
    if (!token) throw new NotFoundException('Session introuvable.');
    if (token.userId !== cmd.userId)
      throw new ForbiddenException('Accès refusé.');

    await this.refreshRepo.revoke(cmd.sessionId);
    return { message: 'Session révoquée.' };
  }
}

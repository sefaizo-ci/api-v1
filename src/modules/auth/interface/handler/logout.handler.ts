import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as crypto from 'crypto';
import type { IRefreshTokenRepository } from '../../core/services/refresh-token.service.interface';
import { LogoutCommand } from '../commands/logout.command';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(
    @Inject('IRefreshTokenRepository')
    private readonly refreshRepo: IRefreshTokenRepository,
  ) {}

  async execute(cmd: LogoutCommand): Promise<{ message: string }> {
    if (cmd.allDevices) {
      await this.refreshRepo.revokeAllForUser(cmd.userId);
      return { message: 'Déconnecté de tous les appareils.' };
    }

    if (cmd.refreshToken) {
      const hash = crypto
        .createHash('sha256')
        .update(cmd.refreshToken)
        .digest('hex');
      const token = await this.refreshRepo.findByHash(hash);
      if (token) await this.refreshRepo.revoke(token.id);
    }

    return { message: 'Déconnecté avec succès.' };
  }
}

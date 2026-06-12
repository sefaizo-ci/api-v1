import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as crypto from 'crypto';
import type { IRefreshTokenRepository } from '../../core/services/refresh-token.service.interface';
import type { IUserRepository } from '../../core/services/user.service.interface';
import { LogoutCommand } from '../commands/logout.command';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(
    @Inject('IRefreshTokenRepository')
    private readonly refreshRepo: IRefreshTokenRepository,
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async execute(cmd: LogoutCommand): Promise<{ message: string }> {
    const professionalId =
      cmd.app === 'PROFESSIONAL'
        ? await this.userRepo.getProfessionalId(cmd.userId)
        : null;

    if (cmd.allDevices) {
      await this.refreshRepo.revokeAllForUser(cmd.userId);
      await this.userRepo.logAuthEvent({
        event: 'LOGOUT_ALL_DEVICES',
        userId: cmd.userId,
        metadata: { app: cmd.app ?? null, professionalId },
      });
      return { message: 'Déconnecté de tous les appareils.' };
    }

    let revoked = 0;

    if (cmd.refreshToken) {
      const hash = crypto
        .createHash('sha256')
        .update(cmd.refreshToken)
        .digest('hex');
      const token = await this.refreshRepo.findByHash(hash);
      if (token && token.userId === cmd.userId && !token.isRevoked) {
        await this.refreshRepo.revoke(token.id);
        revoked = 1;
      }
    }

    if (revoked === 0 && cmd.app) {
      revoked = await this.refreshRepo.revokeActiveForUserAndApp(
        cmd.userId,
        cmd.app,
      );
    }

    await this.userRepo.logAuthEvent({
      event: 'LOGOUT',
      userId: cmd.userId,
      metadata: { app: cmd.app ?? null, professionalId, revoked },
    });

    return { message: 'Déconnecté avec succès.' };
  }
}

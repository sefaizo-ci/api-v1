import { Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as crypto from 'crypto';
import type { IRefreshTokenRepository } from '../../core/services/refresh-token.service.interface';
import type { IUserRepository } from '../../core/services/user.service.interface';

import { TokenService } from '../../services/token.service';
import { RefreshTokenCommand } from '../commands/refresh-token.command';

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<RefreshTokenCommand> {
  constructor(
    @Inject('IRefreshTokenRepository')
    private readonly refreshRepo: IRefreshTokenRepository,
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(cmd: RefreshTokenCommand) {
    const hash = crypto
      .createHash('sha256')
      .update(cmd.refreshToken)
      .digest('hex');
    const token = await this.refreshRepo.findByHash(hash);

    if (!token || !token.isValid()) {
      throw new UnauthorizedException('Session expirée. Reconnectez-vous.');
    }

    const user = await this.userRepo.findById(token.userId);
    if (!user || !user.isAccountActive()) {
      throw new UnauthorizedException('Compte désactivé.');
    }

    await this.refreshRepo.revoke(token.id);

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      phone: user.phone,
      role: user.role,
    });

    const { raw, hash: newHash } = this.tokenService.generateRefreshToken();
    await this.refreshRepo.create({
      userId: user.id,
      tokenHash: newHash,
      deviceInfo: token.deviceInfo ?? undefined,
      ipAddress: token.ipAddress ?? undefined,
      platform: token.platform ?? undefined,
      metadata: {
        source: 'refresh_token_handler',
        previousTokenId: token.id,
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken: raw };
  }
}

import { Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import type { IRefreshTokenRepository } from '../../core/services/refresh-token.service.interface';
import type { IUserRepository } from '../../core/services/user.service.interface';

import { TokenService } from '../../services/token.service';
import { LoginCommand } from '../commands/login.command';
import { withAuthFlowMetadata } from '../utils/auth-metadata.util';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IRefreshTokenRepository')
    private readonly refreshRepo: IRefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(cmd: LoginCommand) {
    const user = await this.userRepo.findById(cmd.userId);
    if (!user || !user.isAccountActive())
      throw new UnauthorizedException('Compte introuvable.');
    if (!user.hasPin()) throw new UnauthorizedException('PIN non configuré.');
    if (user.isPinBlocked())
      throw new UnauthorizedException('PIN bloqué 1 heure.');

    const pinValid = await bcrypt.compare(
      cmd.pin,
      user.clientSecret!.secretHash,
    );

    if (!pinValid) {
      await this.userRepo.incrementPinFail(cmd.userId);
      if (user.pinRemainingAttempts() <= 1) {
        await this.userRepo.blockPin(
          cmd.userId,
          new Date(Date.now() + 60 * 60 * 1000),
        );
        throw new UnauthorizedException(
          'Trop de tentatives. PIN bloqué 1 heure.',
        );
      }
      throw new UnauthorizedException(
        `PIN incorrect. ${user.pinRemainingAttempts() - 1} tentative(s) restante(s).`,
      );
    }

    await this.userRepo.resetPinFail(cmd.userId);

    const roles = await this.userRepo.getRolesByUserId(user.id);
    const primaryRole = roles[0] ?? user.role;

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      phone: user.phone,
      role: primaryRole,
      roles,
    });
    const { raw, hash } = this.tokenService.generateRefreshToken();

    await this.refreshRepo.create({
      userId: user.id,
      tokenHash: hash,
      deviceInfo: cmd.deviceInfo,
      ipAddress: cmd.ipAddress,
      platform: cmd.platform,
      metadata: { source: 'login_handler' },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await this.userRepo.updateMetadata(
      user.id,
      withAuthFlowMetadata(user.metadata, {
        status: 'ACTIVE',
        currentStep: 'AUTHENTICATED',
        lastLoginAt: new Date().toISOString(),
      }),
    );

    return {
      accessToken,
      refreshToken: raw,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        role: primaryRole,
        roles,
      },
    };
  }
}

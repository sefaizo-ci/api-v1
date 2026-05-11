import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { LoginApp, UserRole } from '../../core/enums/auth.enums';
import type { OtpPurpose } from '../../core/enums/auth.enums';
import type { IUserRepository } from '../../core/services/user.service.interface';

export interface JwtPayload {
  sub: string;
  phone: string;
  role?: UserRole;
  roles?: UserRole[];
  scope?: 'full' | 'challenge-only';
  purpose?: OtpPurpose;
  app?: LoginApp;
  userId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @Inject('IUserRepository')
    private readonly userRepo: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    // Challenge-only tokens skip the DB lookup — the phone/user may not be fully created yet.
    if (payload.scope === 'challenge-only') {
      return {
        id: payload.sub, // phoneId
        phone: payload.phone,
        scope: 'challenge-only' as const,
        purpose: payload.purpose,
        app: payload.app,
        userId: payload.userId,
      };
    }

    // Full access token — validate user is still active.
    const user = await this.userRepo.findUserById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Session invalide.');
    }

    const hasProfessionalProfile = await this.userRepo.hasProfessionalProfile(
      user.id,
    );

    const role = payload.role ?? user.role;

    return {
      id: user.id,
      phone: payload.phone,
      role,
      hasProfessionalProfile,
    };
  }
}

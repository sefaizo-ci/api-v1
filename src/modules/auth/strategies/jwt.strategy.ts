import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { UserRole } from '../core/enums/auth.enums';
import type { IUserRepository } from '../core/services/user.service.interface';

export interface JwtPayload {
  sub: string;
  phone: string;
  role: UserRole;
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
    const user = await this.userRepo.findById(payload.sub);
    if (!user || !user.isAccountActive()) {
      throw new UnauthorizedException('Session invalide.');
    }
    return { id: user.id, phone: user.phone, role: user.role };
  }
}

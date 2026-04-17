import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import type { StringValue } from 'ms';
import type { UserRole } from '../core/enums/auth.enums';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  generateAccessToken(payload: {
    sub: string;
    phone: string;
    role: UserRole;
    roles?: UserRole[];
  }): string {
    const expiresIn = (this.config.get<string>('JWT_EXPIRES_IN') ??
      '15m') as StringValue;
    return this.jwt.sign(payload, {
      expiresIn,
    });
  }

  generateRefreshToken(): { raw: string; hash: string } {
    const raw = crypto.randomBytes(64).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
  }

  verifyAccessToken(token: string): any {
    return this.jwt.verify(token);
  }
}

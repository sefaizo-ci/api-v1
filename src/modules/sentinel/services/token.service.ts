import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import type { StringValue } from 'ms';
import type { LoginApp, UserRole } from '../core/enums/auth.enums';
import type { OtpPurpose } from '../core/enums/auth.enums';

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
    return this.jwt.sign(payload, { expiresIn });
  }

  // Issued after OTP verification or PIN validation.
  // Only valid for the next step of the auth flow (register/complete, login/complete, pin/reset).
  generateChallengeToken(payload: {
    phoneId: string;
    phone: string;
    purpose: OtpPurpose;
    app: LoginApp;
    userId?: string;
  }): string {
    return this.jwt.sign(
      {
        sub: payload.phoneId,
        phone: payload.phone,
        scope: 'challenge-only',
        purpose: payload.purpose,
        app: payload.app,
        userId: payload.userId,
      },
      { expiresIn: '10m' },
    );
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

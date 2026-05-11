import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

type JwtUser = { scope?: string } & Record<string, unknown>;

// Requires a challenge-only token (issued after OTP verification or PIN validation).
// Blocks full access tokens — this guard is only for flow-completion endpoints.
@Injectable()
export class ChallengeGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = any>(err: any, user: any): TUser {
    const typed = user as JwtUser | undefined;
    if (err || !typed)
      throw new UnauthorizedException('Token de challenge requis.');
    if (typed.scope !== 'challenge-only') {
      throw new UnauthorizedException(
        'Token de challenge requis pour cette étape.',
      );
    }
    return typed as unknown as TUser;
  }
}

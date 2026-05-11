import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

type JwtUser = { scope?: string } & Record<string, unknown>;

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = any>(err: any, user: any): TUser {
    const typed = user as JwtUser | undefined;
    if (err || !typed)
      throw err ?? new UnauthorizedException('Non authentifié.');
    if (typed.scope === 'challenge-only') {
      throw new UnauthorizedException(
        "Token de challenge non accepté. Complétez le flow d'authentification.",
      );
    }
    return typed as unknown as TUser;
  }
}

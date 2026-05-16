import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../../libs/decorators/public.decorator';

type JwtUser = { scope?: string } & Record<string, unknown>;

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

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

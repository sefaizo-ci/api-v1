import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../../libs/decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{
      user?: {
        role?: string;
        roles?: string[];
        hasProfessionalProfile?: boolean;
      };
    }>();

    const effectiveRoles = new Set<string>(user?.roles ?? []);
    if (user?.role) {
      effectiveRoles.add(user.role);
    }
    if (user?.hasProfessionalProfile) {
      effectiveRoles.add('PROFESSIONAL');
    }

    if (effectiveRoles.has('ADMIN')) {
      return true;
    }

    const hasAnyRequiredRole = requiredRoles.some((role) =>
      effectiveRoles.has(role),
    );

    if (!hasAnyRequiredRole) {
      throw new ForbiddenException('Accès refusé.');
    }
    return true;
  }
}

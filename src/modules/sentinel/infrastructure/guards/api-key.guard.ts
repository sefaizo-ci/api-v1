import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  private normalizeApiKey(value: string): string {
    return value.trim().replace(/^"(.*)"$/, '$1');
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expectedApiKey = this.config.get<string>('API_KEY');

    if (!expectedApiKey) {
      throw new UnauthorizedException('API key non configurée côté serveur.');
    }

    const incomingApiKey = req.header('x-api-key');
    if (!incomingApiKey) {
      throw new UnauthorizedException('x-api-key invalide ou manquante.');
    }

    const a = Buffer.from(this.normalizeApiKey(incomingApiKey));
    const b = Buffer.from(this.normalizeApiKey(expectedApiKey));
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!valid) {
      throw new UnauthorizedException('x-api-key invalide ou manquante.');
    }

    return true;
  }
}

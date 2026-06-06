import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { RequestContextService } from '../context/request-context.service';

@Injectable()
export class ContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();

    // The x-request-id header is set by the middleware in main.ts (incoming or generated UUID)
    const raw = response.getHeader('x-request-id');
    const requestId = Array.isArray(raw) ? raw[0] : String(raw ?? 'n/a');

    return new Observable((subscriber) => {
      RequestContextService.run({ requestId }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}

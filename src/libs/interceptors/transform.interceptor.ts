import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { RequestContextService } from '../context/request-context.service';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, unknown>
{
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        correlationId: RequestContextService.getRequestId(),
        timestamp: new Date().toISOString(),
      })),
    );
  }
}

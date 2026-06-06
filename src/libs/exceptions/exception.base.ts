import { RequestContextService } from '../context/request-context.service';

export abstract class DomainException extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly correlationId: string;

  constructor(
    message: string,
    readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.correlationId = RequestContextService.getRequestId();
    Error.captureStackTrace(this, this.constructor);
  }
}

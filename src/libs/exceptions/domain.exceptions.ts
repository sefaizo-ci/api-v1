import { DomainException } from './exception.base';

export class NotFoundException extends DomainException {
  readonly statusCode = 404;
  readonly code: string;

  constructor(
    message = 'Resource not found',
    code = 'NOT_FOUND',
    cause?: Error,
  ) {
    super(message, cause);
    this.code = code;
  }
}

export class ConflictException extends DomainException {
  readonly statusCode = 409;
  readonly code: string;

  constructor(
    message = 'Resource already exists',
    code = 'CONFLICT',
    cause?: Error,
  ) {
    super(message, cause);
    this.code = code;
  }
}

export class BadRequestException extends DomainException {
  readonly statusCode = 400;
  readonly code: string;

  constructor(message = 'Bad request', code = 'BAD_REQUEST', cause?: Error) {
    super(message, cause);
    this.code = code;
  }
}

export class UnauthorizedException extends DomainException {
  readonly statusCode = 401;
  readonly code: string;

  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED', cause?: Error) {
    super(message, cause);
    this.code = code;
  }
}

export class ForbiddenException extends DomainException {
  readonly statusCode = 403;
  readonly code: string;

  constructor(message = 'Forbidden', code = 'FORBIDDEN', cause?: Error) {
    super(message, cause);
    this.code = code;
  }
}

export class UnprocessableException extends DomainException {
  readonly statusCode = 422;
  readonly code: string;

  constructor(
    message = 'Unprocessable entity',
    code = 'UNPROCESSABLE',
    cause?: Error,
  ) {
    super(message, cause);
    this.code = code;
  }
}

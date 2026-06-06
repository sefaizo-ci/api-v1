export class NotFoundException extends Error {
  readonly statusCode = 404;
  readonly code: string;
  readonly cause?: Error;

  constructor(message: string, code = 'NOT_FOUND', cause?: Error) {
    super(message);
    this.name = 'NotFoundException';
    this.code = code;
    this.cause = cause;
  }
}

export class ConflictException extends Error {
  readonly statusCode = 409;
  readonly code: string;
  readonly cause?: Error;

  constructor(message: string, code = 'CONFLICT', cause?: Error) {
    super(message);
    this.name = 'ConflictException';
    this.code = code;
    this.cause = cause;
  }
}

export class BadRequestException extends Error {
  readonly statusCode = 400;
  readonly code: string;
  readonly cause?: Error;

  constructor(message: string, code = 'BAD_REQUEST', cause?: Error) {
    super(message);
    this.name = 'BadRequestException';
    this.code = code;
    this.cause = cause;
  }
}

export class UnauthorizedException extends Error {
  readonly statusCode = 401;
  readonly code: string;
  readonly cause?: Error;

  constructor(message: string, code = 'UNAUTHORIZED', cause?: Error) {
    super(message);
    this.name = 'UnauthorizedException';
    this.code = code;
    this.cause = cause;
  }
}

export class ForbiddenException extends Error {
  readonly statusCode = 403;
  readonly code: string;
  readonly cause?: Error;

  constructor(message: string, code = 'FORBIDDEN', cause?: Error) {
    super(message);
    this.name = 'ForbiddenException';
    this.code = code;
    this.cause = cause;
  }
}

export class UnprocessableException extends Error {
  readonly statusCode = 422;
  readonly code: string;
  readonly cause?: Error;

  constructor(message: string, code = 'UNPROCESSABLE', cause?: Error) {
    super(message);
    this.name = 'UnprocessableException';
    this.code = code;
    this.cause = cause;
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableException,
} from '../exceptions/domain.exceptions';

type DomainException =
  | NotFoundException
  | ConflictException
  | BadRequestException
  | UnauthorizedException
  | ForbiddenException
  | UnprocessableException;

function isDomainException(err: unknown): err is DomainException {
  return (
    err instanceof NotFoundException ||
    err instanceof ConflictException ||
    err instanceof BadRequestException ||
    err instanceof UnauthorizedException ||
    err instanceof ForbiddenException ||
    err instanceof UnprocessableException
  );
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  private toRequestId(value: string | number | string[] | undefined): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (Array.isArray(value) && value.length > 0) {
      return value.join(',');
    }

    return 'n/a';
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = this.toRequestId(response.getHeader('x-request-id'));

    let status: number;
    let message: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } else if (isDomainException(exception)) {
      status = exception.statusCode;
      message = exception.message;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Erreur interne du serveur.';
    }

    const context = `[requestId=${requestId}] ${request.method} ${request.url} -> ${status}`;

    if (exception instanceof Error) {
      this.logger.error(`${context} | ${exception.name}: ${exception.message}`);
      if (exception.stack) {
        this.logger.error(exception.stack);
      }
    } else {
      this.logger.error(
        `${context} | non-Error exception: ${String(exception)}`,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

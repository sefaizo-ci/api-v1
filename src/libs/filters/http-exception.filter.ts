import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RequestContextService } from '../context/request-context.service';
import { DomainException } from '../exceptions/exception.base';

function extractMessages(exception: HttpException): string[] {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return [response];
  }
  if (typeof response === 'object' && response !== null) {
    const msg = (response as Record<string, unknown>)['message'];
    if (Array.isArray(msg)) return msg.map(String);
    if (typeof msg === 'string') return [msg];
  }
  return [exception.message];
}

function extractError(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'object' && response !== null) {
    const err = (response as Record<string, unknown>)['error'];
    if (typeof err === 'string') return err;
  }
  return exception.message;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = RequestContextService.getRequestId();

    // Domain exceptions — thrown from handlers/services
    if (exception instanceof DomainException) {
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} -> ${exception.statusCode} | ${exception.code}: ${exception.message}`,
      );
      return response.status(exception.statusCode).json({
        success: false,
        statusCode: exception.statusCode,
        error: exception.code,
        message: [exception.message],
        correlationId: exception.correlationId,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    // NestJS HTTP exceptions — from guards, pipes, decorators
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} -> ${status} | ${exception.message}`,
      );
      return response.status(status).json({
        success: false,
        statusCode: status,
        error: extractError(exception),
        message: extractMessages(exception),
        correlationId,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    // Unhandled errors — bugs, infra failures
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    if (exception instanceof Error) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} -> ${status} | ${exception.name}: ${exception.message}`,
      );
      if (exception.stack) {
        this.logger.debug(exception.stack);
      }
    } else {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} -> ${status} | ${String(exception)}`,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error: 'Internal Server Error',
      message: ['Erreur interne du serveur.'],
      correlationId,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

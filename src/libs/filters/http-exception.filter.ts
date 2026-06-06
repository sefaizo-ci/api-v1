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

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const messages =
      exception instanceof HttpException
        ? extractMessages(exception)
        : ['Erreur interne du serveur.'];

    const error =
      exception instanceof HttpException
        ? extractError(exception)
        : 'Internal Server Error';

    const logContext = `[${correlationId}] ${request.method} ${request.url} -> ${status}`;

    if (exception instanceof Error) {
      this.logger.error(
        `${logContext} | ${exception.name}: ${exception.message}`,
      );
      if (exception.stack) {
        this.logger.debug(exception.stack);
      }
    } else {
      this.logger.error(`${logContext} | ${String(exception)}`);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error,
      message: messages,
      correlationId,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

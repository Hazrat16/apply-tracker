import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  /** Field-level validation errors (see ZodValidationPipe). */
  issues?: { path: string; message: string }[];
  path: string;
  timestamp: string;
  requestId?: string;
}

/** Turns every thrown error into one consistent JSON error shape. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { id?: string }>();

    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let issues: ErrorResponse['issues'];
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const body = res as Pick<ErrorResponse, 'message' | 'issues'>;
        message = body.message ?? exception.message;
        issues = body.issues;
      }
    } else {
      this.logger.error(exception);
    }

    const body: ErrorResponse = {
      statusCode,
      error: HttpStatus[statusCode] ?? 'ERROR',
      message,
      ...(issues && { issues }),
      path: httpAdapter.getRequestUrl(request) as string,
      timestamp: new Date().toISOString(),
      requestId: request.id,
    };

    httpAdapter.reply(ctx.getResponse(), body, statusCode);
  }
}

import { ApiErrorCode, createErrorResponse } from '@entrostat-otp/shared';
import type { ErrorRequestHandler } from 'express';

type LoggableError = {
  message: string;
  name?: string;
  stack?: string;
};

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  void next;

  if (error instanceof SyntaxError && 'body' in error) {
    response
      .status(400)
      .json(createErrorResponse(ApiErrorCode.MalformedJson, 'Malformed JSON body.'));
    return;
  }

  console.error('Unexpected API error', {
    error: toLoggableError(error),
    method: request.method,
    path: request.originalUrl || request.url,
  });

  response
    .status(500)
    .json(createErrorResponse(ApiErrorCode.InternalServerError, 'Internal server error.'));
};

function toLoggableError(error: unknown): LoggableError {
  if (error instanceof Error) {
    const loggableError: LoggableError = {
      message: redactSensitiveValues(error.message),
      name: error.name,
    };

    if (error.stack) {
      loggableError.stack = redactSensitiveValues(error.stack);
    }

    return loggableError;
  }

  return {
    message: redactSensitiveValues(String(error)),
  };
}

function redactSensitiveValues(value: string): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return value;
  }

  return value.replaceAll(databaseUrl, '[DATABASE_URL redacted]');
}

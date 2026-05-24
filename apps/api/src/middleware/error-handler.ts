import { ApiErrorCode, createErrorResponse } from '@entrostat-otp/shared';
import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  void next;

  if (error instanceof SyntaxError && 'body' in error) {
    response
      .status(400)
      .json(createErrorResponse(ApiErrorCode.MalformedJson, 'Malformed JSON body.'));
    return;
  }

  response
    .status(500)
    .json(createErrorResponse(ApiErrorCode.InternalServerError, 'Internal server error.'));
};

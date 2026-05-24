import { ApiErrorCode, createErrorResponse } from '@entrostat-otp/shared';
import type { RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json(createErrorResponse(ApiErrorCode.NotFound, 'Not found.'));
};

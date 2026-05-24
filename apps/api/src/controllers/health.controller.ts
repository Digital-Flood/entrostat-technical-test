import { createSuccessResponse } from '@entrostat-otp/shared';
import type { RequestHandler } from 'express';

export const getHealth: RequestHandler = (_request, response) => {
  response.status(200).json(createSuccessResponse({ status: 'ok' }));
};

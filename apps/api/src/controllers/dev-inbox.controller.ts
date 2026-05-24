import { ApiErrorCode, createErrorResponse, createSuccessResponse } from '@entrostat-otp/shared';
import type { RequestHandler } from 'express';

import {
  DevOtpInboxService,
  DevOtpInboxUnavailableError,
  type DevOtpInboxResult,
} from '../services/dev-otp-inbox.service.js';

export type DevOtpInboxUseCase = {
  listDeliveries(): DevOtpInboxResult;
};

export function createDevOtpInboxController(service?: DevOtpInboxUseCase): RequestHandler {
  return (request, response, next) => {
    void request;

    try {
      const inboxService = service ?? new DevOtpInboxService();
      const result = inboxService.listDeliveries();

      response.status(200).json(createSuccessResponse(result));
    } catch (error) {
      if (error instanceof DevOtpInboxUnavailableError) {
        response
          .status(404)
          .json(createErrorResponse(ApiErrorCode.NotFound, 'Demo OTP inbox is not available.'));
        return;
      }

      next(error);
    }
  };
}

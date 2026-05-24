import { ApiErrorCode, createErrorResponse, createSuccessResponse } from '@entrostat-otp/shared';
import type { RequestHandler } from 'express';

import type { OtpRequestBody } from '../validators/otp-request.validator.js';
import type { OtpRequestResult } from '../services/otp-request.service.js';
import { OtpRequestRateLimitError } from '../services/otp-request.errors.js';

export type OtpRequestUseCase = {
  requestOtp(input: OtpRequestBody): Promise<OtpRequestResult>;
};

export function createOtpRequestController(service?: OtpRequestUseCase): RequestHandler {
  return async (request, response, next) => {
    try {
      const requestService = service ?? (await getDefaultOtpRequestService());
      const result = await requestService.requestOtp(request.body as OtpRequestBody);

      response.status(201).json(createSuccessResponse(result));
    } catch (error) {
      if (error instanceof OtpRequestRateLimitError) {
        response.status(429).json(
          createErrorResponse(ApiErrorCode.OtpRateLimited, 'OTP request limit exceeded.', {
            maxRequestsPerHour: error.maxRequestsPerHour,
          }),
        );
        return;
      }

      next(error);
    }
  };
}

let defaultOtpRequestService: OtpRequestUseCase | undefined;

async function getDefaultOtpRequestService(): Promise<OtpRequestUseCase> {
  if (defaultOtpRequestService) {
    return defaultOtpRequestService;
  }

  const [
    { getOtpConfig },
    { createOtpDeliveryAdapter },
    { otpRepository, withOtpRepositoryTransaction },
    { OtpRequestService },
  ] = await Promise.all([
    import('../config/otp.config.js'),
    import('../delivery/otp-delivery.adapter.js'),
    import('../repositories/otp.repository.js'),
    import('../services/otp-request.service.js'),
  ]);
  const config = getOtpConfig();

  defaultOtpRequestService = new OtpRequestService({
    config,
    delivery: createOtpDeliveryAdapter(config),
    repository: otpRepository,
    withTransaction: withOtpRepositoryTransaction,
  });

  return defaultOtpRequestService;
}

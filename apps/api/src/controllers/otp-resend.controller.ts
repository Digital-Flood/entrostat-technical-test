import { ApiErrorCode, createErrorResponse, createSuccessResponse } from '@entrostat-otp/shared';
import type { RequestHandler } from 'express';

import {
  OtpResendLimitError,
  OtpResendMissingError,
  OtpResendReusedError,
  OtpResendWindowExpiredError,
  type OtpResendResult,
} from '../services/otp-resend.service.js';
import type { OtpResendBody } from '../validators/otp-resend.validator.js';

export type OtpResendUseCase = {
  resendOtp(input: OtpResendBody): Promise<OtpResendResult>;
};

export function createOtpResendController(service?: OtpResendUseCase): RequestHandler {
  return async (request, response, next) => {
    try {
      const resendService = service ?? (await getDefaultOtpResendService());
      const result = await resendService.resendOtp(request.body as OtpResendBody);

      response.status(200).json(createSuccessResponse(result));
    } catch (error) {
      if (error instanceof OtpResendMissingError) {
        response
          .status(404)
          .json(createErrorResponse(ApiErrorCode.OtpMissing, 'No OTP exists for this email.'));
        return;
      }

      if (error instanceof OtpResendWindowExpiredError) {
        response.status(410).json(
          createErrorResponse(ApiErrorCode.OtpExpired, 'OTP resend window has expired.', {
            resendAvailableUntil: error.resendAvailableUntil.toISOString(),
            resendWindowMinutes: error.resendWindowMinutes,
          }),
        );
        return;
      }

      if (error instanceof OtpResendReusedError) {
        response
          .status(409)
          .json(createErrorResponse(ApiErrorCode.OtpReused, 'OTP has already been verified.'));
        return;
      }

      if (error instanceof OtpResendLimitError) {
        response.status(429).json(
          createErrorResponse(ApiErrorCode.OtpResendLimited, 'OTP resend limit exceeded.', {
            maxResends: error.maxResends,
          }),
        );
        return;
      }

      next(error);
    }
  };
}

let defaultOtpResendService: OtpResendUseCase | undefined;

async function getDefaultOtpResendService(): Promise<OtpResendUseCase> {
  if (defaultOtpResendService) {
    return defaultOtpResendService;
  }

  const [
    { getOtpConfig },
    { createOtpDeliveryAdapter },
    { otpRepository, withOtpRepositoryTransaction },
    { OtpResendService },
    { otpSettingsService },
  ] = await Promise.all([
    import('../config/otp.config.js'),
    import('../delivery/otp-delivery.adapter.js'),
    import('../repositories/otp.repository.js'),
    import('../services/otp-resend.service.js'),
    import('../services/otp-settings.service.js'),
  ]);
  const config = getOtpConfig();

  defaultOtpResendService = new OtpResendService({
    config,
    delivery: createOtpDeliveryAdapter(config),
    repository: otpRepository,
    settingsProvider: otpSettingsService,
    withTransaction: withOtpRepositoryTransaction,
  });

  return defaultOtpResendService;
}

import { ApiErrorCode, createErrorResponse, createSuccessResponse } from '@entrostat-otp/shared';
import type { RequestHandler } from 'express';

import {
  OtpVerifyExpiredError,
  OtpVerifyIncorrectError,
  OtpVerifyMissingError,
  OtpVerifyReusedError,
  OtpVerifySupersededError,
  type OtpVerifyResult,
} from '../services/otp-verify.service.js';
import type { OtpVerifyBody } from '../validators/otp-verify.validator.js';

export type OtpVerifyUseCase = {
  verifyOtp(input: OtpVerifyBody): Promise<OtpVerifyResult>;
};

export function createOtpVerifyController(service?: OtpVerifyUseCase): RequestHandler {
  return async (request, response, next) => {
    try {
      const verifyService = service ?? (await getDefaultOtpVerifyService());
      const result = await verifyService.verifyOtp(request.body as OtpVerifyBody);

      response.status(200).json(createSuccessResponse(result));
    } catch (error) {
      if (error instanceof OtpVerifyMissingError) {
        response
          .status(404)
          .json(createErrorResponse(ApiErrorCode.OtpMissing, 'No OTP exists for this email.'));
        return;
      }

      if (error instanceof OtpVerifySupersededError) {
        response
          .status(409)
          .json(createErrorResponse(ApiErrorCode.OtpSuperseded, 'OTP has been superseded.'));
        return;
      }

      if (error instanceof OtpVerifyExpiredError) {
        response.status(410).json(
          createErrorResponse(ApiErrorCode.OtpExpired, 'OTP has expired.', {
            expiresAt: error.expiresAt.toISOString(),
          }),
        );
        return;
      }

      if (error instanceof OtpVerifyReusedError) {
        response
          .status(409)
          .json(createErrorResponse(ApiErrorCode.OtpReused, 'OTP has already been verified.'));
        return;
      }

      if (error instanceof OtpVerifyIncorrectError) {
        response
          .status(401)
          .json(createErrorResponse(ApiErrorCode.OtpIncorrect, 'OTP code is incorrect.'));
        return;
      }

      next(error);
    }
  };
}

let defaultOtpVerifyService: OtpVerifyUseCase | undefined;

async function getDefaultOtpVerifyService(): Promise<OtpVerifyUseCase> {
  if (defaultOtpVerifyService) {
    return defaultOtpVerifyService;
  }

  const [{ otpRepository, withOtpRepositoryTransaction }, { OtpVerifyService }] = await Promise.all(
    [import('../repositories/otp.repository.js'), import('../services/otp-verify.service.js')],
  );

  defaultOtpVerifyService = new OtpVerifyService({
    repository: otpRepository,
    withTransaction: withOtpRepositoryTransaction,
  });

  return defaultOtpVerifyService;
}

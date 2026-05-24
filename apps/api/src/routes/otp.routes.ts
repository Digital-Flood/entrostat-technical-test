import { Router } from 'express';

import {
  createOtpRequestController,
  type OtpRequestUseCase,
} from '../controllers/otp-request.controller.js';
import {
  createOtpResendController,
  type OtpResendUseCase,
} from '../controllers/otp-resend.controller.js';
import {
  createOtpVerifyController,
  type OtpVerifyUseCase,
} from '../controllers/otp-verify.controller.js';
import { validateOtpRequestBody } from '../validators/otp-request.validator.js';
import { validateOtpResendBody } from '../validators/otp-resend.validator.js';
import { validateOtpVerifyBody } from '../validators/otp-verify.validator.js';

export type OtpRouterDependencies = {
  requestService?: OtpRequestUseCase;
  resendService?: OtpResendUseCase;
  verifyService?: OtpVerifyUseCase;
};

export function createOtpRouter(dependencies: OtpRouterDependencies = {}) {
  const router = Router();

  router.post(
    '/request',
    validateOtpRequestBody,
    createOtpRequestController(dependencies.requestService),
  );

  router.post(
    '/resend',
    validateOtpResendBody,
    createOtpResendController(dependencies.resendService),
  );

  router.post(
    '/verify',
    validateOtpVerifyBody,
    createOtpVerifyController(dependencies.verifyService),
  );

  return router;
}

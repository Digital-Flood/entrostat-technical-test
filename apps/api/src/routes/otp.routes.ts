import { Router } from 'express';

import {
  createOtpRequestController,
  type OtpRequestUseCase,
} from '../controllers/otp-request.controller.js';
import {
  createOtpResendController,
  type OtpResendUseCase,
} from '../controllers/otp-resend.controller.js';
import { validateOtpRequestBody } from '../validators/otp-request.validator.js';
import { validateOtpResendBody } from '../validators/otp-resend.validator.js';

export type OtpRouterDependencies = {
  requestService?: OtpRequestUseCase;
  resendService?: OtpResendUseCase;
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

  return router;
}

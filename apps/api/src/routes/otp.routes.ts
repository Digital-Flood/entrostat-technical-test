import { Router } from 'express';

import {
  createOtpRequestController,
  type OtpRequestUseCase,
} from '../controllers/otp-request.controller.js';
import { validateOtpRequestBody } from '../validators/otp-request.validator.js';

export type OtpRouterDependencies = {
  requestService?: OtpRequestUseCase;
};

export function createOtpRouter(dependencies: OtpRouterDependencies = {}) {
  const router = Router();

  router.post(
    '/request',
    validateOtpRequestBody,
    createOtpRequestController(dependencies.requestService),
  );

  return router;
}

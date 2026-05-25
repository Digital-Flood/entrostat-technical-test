import { Router } from 'express';

import {
  createGetOtpSettingsController,
  createUpdateOtpSettingsController,
  type OtpSettingsUseCase,
} from '../controllers/otp-settings.controller.js';
import { validateOtpSettingsBody } from '../validators/otp-settings.validator.js';

export type SettingsRouterDependencies = {
  otpSettingsService?: OtpSettingsUseCase;
};

export function createSettingsRouter(dependencies: SettingsRouterDependencies = {}) {
  const router = Router();

  router.get('/otp', createGetOtpSettingsController(dependencies.otpSettingsService));
  router.put(
    '/otp',
    validateOtpSettingsBody,
    createUpdateOtpSettingsController(dependencies.otpSettingsService),
  );

  return router;
}

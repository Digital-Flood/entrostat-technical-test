import { createSuccessResponse } from '@entrostat-otp/shared';
import type { RequestHandler } from 'express';

import {
  otpSettingsService,
  type OtpSettingsResult,
  type OtpSettingsService,
} from '../services/otp-settings.service.js';
import type { OtpSettingsBody } from '../validators/otp-settings.validator.js';

export type OtpSettingsUseCase = Pick<OtpSettingsService, 'getOtpSettings' | 'updateOtpSettings'>;

export function createGetOtpSettingsController(service?: OtpSettingsUseCase): RequestHandler {
  return (_request, response) => {
    const settingsService = service ?? otpSettingsService;

    response.status(200).json(createSuccessResponse(settingsService.getOtpSettings()));
  };
}

export function createUpdateOtpSettingsController(service?: OtpSettingsUseCase): RequestHandler {
  return (request, response) => {
    const settingsService = service ?? otpSettingsService;
    const result: OtpSettingsResult = settingsService.updateOtpSettings(
      request.body as OtpSettingsBody,
    );

    response.status(200).json(createSuccessResponse(result));
  };
}

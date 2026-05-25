import { ApiErrorCode, createErrorResponse } from '@entrostat-otp/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';

export const otpSettingsSchema = z
  .object({
    expirySeconds: z.number().int().positive(),
    maxRequestsPerHour: z.number().int().positive(),
    maxResends: z.number().int().positive(),
    resendWindowMinutes: z.number().int().positive(),
  })
  .strict();

export type OtpSettingsBody = z.infer<typeof otpSettingsSchema>;

type ValidationIssue = {
  field: string;
  message: string;
};

export const validateOtpSettingsBody: RequestHandler = (request, response, next) => {
  const result = otpSettingsSchema.safeParse(request.body);

  if (!result.success) {
    response
      .status(400)
      .json(
        createErrorResponse(
          ApiErrorCode.ValidationError,
          'Validation failed.',
          result.error.issues.map(formatValidationIssue),
        ),
      );
    return;
  }

  request.body = result.data;
  next();
};

function formatValidationIssue(issue: z.core.$ZodIssue): ValidationIssue {
  return {
    field: issue.path.join('.') || 'body',
    message: issue.message,
  };
}

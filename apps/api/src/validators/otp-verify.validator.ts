import { ApiErrorCode, createErrorResponse } from '@entrostat-otp/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';

import { getOtpConfig } from '../config/otp.config.js';

export type OtpVerifyBody = {
  code: string;
  email: string;
};

export function createOtpVerifySchema(codeLength = getOtpConfig().codeLength) {
  return z
    .object({
      code: z
        .string()
        .trim()
        .length(codeLength)
        .regex(/^\d+$/, 'OTP code must contain digits only.'),
      email: z
        .string()
        .trim()
        .email()
        .max(320)
        .transform((email) => email.toLowerCase()),
    })
    .strict();
}

type ValidationIssue = {
  field: string;
  message: string;
};

export const validateOtpVerifyBody: RequestHandler = (request, response, next) => {
  const result = createOtpVerifySchema().safeParse(request.body);

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

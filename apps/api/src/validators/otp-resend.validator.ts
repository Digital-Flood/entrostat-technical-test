import { ApiErrorCode, createErrorResponse } from '@entrostat-otp/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';

export const otpResendSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((email) => email.toLowerCase()),
  })
  .strict();

export type OtpResendBody = z.infer<typeof otpResendSchema>;

type ValidationIssue = {
  field: string;
  message: string;
};

export const validateOtpResendBody: RequestHandler = (request, response, next) => {
  const result = otpResendSchema.safeParse(request.body);

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

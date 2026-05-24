import { ApiErrorCode, createErrorResponse } from '@entrostat-otp/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';

export const otpRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((email) => email.toLowerCase()),
  })
  .strict();

export type OtpRequestBody = z.infer<typeof otpRequestSchema>;

type ValidationIssue = {
  field: string;
  message: string;
};

export const validateOtpRequestBody: RequestHandler = (request, response, next) => {
  const result = otpRequestSchema.safeParse(request.body);

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

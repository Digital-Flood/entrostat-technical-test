export const ApiErrorCode = {
  ValidationError: 'VALIDATION_ERROR',
  NotFound: 'NOT_FOUND',
  MalformedJson: 'MALFORMED_JSON',
  InternalServerError: 'INTERNAL_SERVER_ERROR',
  OtpRateLimited: 'OTP_RATE_LIMITED',
  OtpResendLimited: 'OTP_RESEND_LIMITED',
  OtpExpired: 'OTP_EXPIRED',
  OtpSuperseded: 'OTP_SUPERSEDED',
  OtpReused: 'OTP_REUSED',
  OtpIncorrect: 'OTP_INCORRECT',
  OtpMissing: 'OTP_MISSING',
} as const;

export type ApiErrorCodeValue = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

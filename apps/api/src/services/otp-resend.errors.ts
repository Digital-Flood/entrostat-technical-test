export class OtpResendMissingError extends Error {
  constructor() {
    super('No OTP exists for this email address.');
    this.name = 'OtpResendMissingError';
  }
}

export class OtpResendWindowExpiredError extends Error {
  constructor(
    readonly resendWindowMinutes: number,
    readonly resendAvailableUntil: Date,
  ) {
    super('OTP resend window has expired.');
    this.name = 'OtpResendWindowExpiredError';
  }
}

export class OtpResendLimitError extends Error {
  constructor(readonly maxResends: number) {
    super('OTP resend limit exceeded.');
    this.name = 'OtpResendLimitError';
  }
}

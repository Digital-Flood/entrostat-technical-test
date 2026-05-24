export class OtpVerifyMissingError extends Error {
  constructor() {
    super('No OTP exists for this email address.');
    this.name = 'OtpVerifyMissingError';
  }
}

export class OtpVerifySupersededError extends Error {
  constructor() {
    super('OTP has been superseded by a newer code.');
    this.name = 'OtpVerifySupersededError';
  }
}

export class OtpVerifyExpiredError extends Error {
  constructor(readonly expiresAt: Date) {
    super('OTP has expired.');
    this.name = 'OtpVerifyExpiredError';
  }
}

export class OtpVerifyReusedError extends Error {
  constructor() {
    super('OTP has already been verified.');
    this.name = 'OtpVerifyReusedError';
  }
}

export class OtpVerifyIncorrectError extends Error {
  constructor() {
    super('OTP code is incorrect.');
    this.name = 'OtpVerifyIncorrectError';
  }
}

export class OtpRequestRateLimitError extends Error {
  constructor(readonly maxRequestsPerHour: number) {
    super('OTP request limit exceeded.');
  }
}

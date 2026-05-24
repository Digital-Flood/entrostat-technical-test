import { describe, expect, it } from 'vitest';

import { createOtpDeliveryAdapter } from './otp-delivery.adapter.js';

describe('createOtpDeliveryAdapter', () => {
  it('fails safely when production delivery is missing required configuration', () => {
    expect(() =>
      createOtpDeliveryAdapter({
        codeLength: 6,
        deliveryMode: 'production',
        emailFrom: undefined,
        expirySeconds: 300,
        maxRequestsPerHour: 5,
        resendApiKey: undefined,
      }),
    ).toThrow('Production OTP delivery requires RESEND_API_KEY and OTP_EMAIL_FROM.');
  });
});

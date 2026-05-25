import { describe, expect, it } from 'vitest';

import { InMemoryOtpSettingsService } from './otp-settings.service.js';

describe('InMemoryOtpSettingsService', () => {
  it('starts with assessment defaults and fixed OTP length', () => {
    const service = new InMemoryOtpSettingsService();

    expect(service.getOtpSettings()).toEqual({
      codeLength: 6,
      expirySeconds: 30,
      maxRequestsPerHour: 3,
      maxResends: 3,
      resendWindowMinutes: 5,
    });
  });

  it('updates runtime OTP rule settings without changing OTP length', () => {
    const service = new InMemoryOtpSettingsService();

    const result = service.updateOtpSettings({
      expirySeconds: 45,
      maxRequestsPerHour: 4,
      maxResends: 2,
      resendWindowMinutes: 8,
    });

    expect(result).toEqual({
      codeLength: 6,
      expirySeconds: 45,
      maxRequestsPerHour: 4,
      maxResends: 2,
      resendWindowMinutes: 8,
    });
    expect(service.getSettings()).toEqual({
      expirySeconds: 45,
      maxRequestsPerHour: 4,
      maxResends: 2,
      resendWindowMinutes: 8,
    });
  });
});

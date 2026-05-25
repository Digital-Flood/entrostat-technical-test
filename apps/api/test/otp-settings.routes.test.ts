import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import type { OtpSettingsUseCase } from '../src/controllers/otp-settings.controller.js';

describe('GET /settings/otp', () => {
  it('returns the current OTP settings', async () => {
    const getOtpSettings = vi.fn<OtpSettingsUseCase['getOtpSettings']>().mockReturnValue({
      codeLength: 6,
      expirySeconds: 30,
      maxRequestsPerHour: 3,
      maxResends: 3,
      resendWindowMinutes: 5,
    });
    const updateOtpSettings = vi.fn<OtpSettingsUseCase['updateOtpSettings']>();
    const app = createApp({
      settings: {
        otpSettingsService: {
          getOtpSettings,
          updateOtpSettings,
        },
      },
    });

    const response = await request(app).get('/settings/otp');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        codeLength: 6,
        expirySeconds: 30,
        maxRequestsPerHour: 3,
        maxResends: 3,
        resendWindowMinutes: 5,
      },
    });
    expect(getOtpSettings).toHaveBeenCalledOnce();
    expect(updateOtpSettings).not.toHaveBeenCalled();
  });
});

describe('PUT /settings/otp', () => {
  it('updates OTP settings after validation', async () => {
    const getOtpSettings = vi.fn<OtpSettingsUseCase['getOtpSettings']>();
    const updateOtpSettings = vi.fn<OtpSettingsUseCase['updateOtpSettings']>().mockReturnValue({
      codeLength: 6,
      expirySeconds: 45,
      maxRequestsPerHour: 4,
      maxResends: 2,
      resendWindowMinutes: 8,
    });
    const app = createApp({
      settings: {
        otpSettingsService: {
          getOtpSettings,
          updateOtpSettings,
        },
      },
    });

    const response = await request(app).put('/settings/otp').send({
      expirySeconds: 45,
      maxRequestsPerHour: 4,
      maxResends: 2,
      resendWindowMinutes: 8,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        codeLength: 6,
        expirySeconds: 45,
        maxRequestsPerHour: 4,
        maxResends: 2,
        resendWindowMinutes: 8,
      },
    });
    expect(updateOtpSettings).toHaveBeenCalledWith({
      expirySeconds: 45,
      maxRequestsPerHour: 4,
      maxResends: 2,
      resendWindowMinutes: 8,
    });
    expect(getOtpSettings).not.toHaveBeenCalled();
  });

  it('rejects invalid OTP settings', async () => {
    const getOtpSettings = vi.fn<OtpSettingsUseCase['getOtpSettings']>();
    const updateOtpSettings = vi.fn<OtpSettingsUseCase['updateOtpSettings']>();
    const app = createApp({
      settings: {
        otpSettingsService: {
          getOtpSettings,
          updateOtpSettings,
        },
      },
    });

    const response = await request(app).put('/settings/otp').send({
      expirySeconds: 0,
      maxRequestsPerHour: 3,
      maxResends: 3,
      resendWindowMinutes: 5,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        details: [
          {
            field: 'expirySeconds',
            message: expect.any(String),
          },
        ],
        message: 'Validation failed.',
      },
    });
    expect(updateOtpSettings).not.toHaveBeenCalled();
  });
});

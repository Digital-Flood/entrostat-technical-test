import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import type { OtpResendUseCase } from '../src/controllers/otp-resend.controller.js';
import {
  OtpResendLimitError,
  OtpResendMissingError,
  OtpResendReusedError,
  OtpResendWindowExpiredError,
} from '../src/services/otp-resend.service.js';

describe('POST /otp/resend', () => {
  it('returns the shared success envelope for a valid resend', async () => {
    const resendOtp = vi.fn<OtpResendUseCase['resendOtp']>().mockResolvedValue({
      delivery: {
        mode: 'demo',
        status: 'captured',
      },
      email: 'person@example.com',
      expiresAt: '2026-05-24T12:05:00.000Z',
      expiresInSeconds: 300,
      resendCount: 1,
    });
    const app = createApp({
      otp: {
        resendService: {
          resendOtp,
        },
      },
    });

    const response = await request(app).post('/otp/resend').send({ email: ' Person@Example.com ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        delivery: {
          mode: 'demo',
          status: 'captured',
        },
        email: 'person@example.com',
        expiresAt: '2026-05-24T12:05:00.000Z',
        expiresInSeconds: 300,
        resendCount: 1,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('654321');
    expect(resendOtp).toHaveBeenCalledWith({ email: 'person@example.com' });
  });

  it('returns the shared validation error envelope for an invalid email', async () => {
    const resendOtp = vi.fn<OtpResendUseCase['resendOtp']>();
    const app = createApp({
      otp: {
        resendService: {
          resendOtp,
        },
      },
    });

    const response = await request(app).post('/otp/resend').send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        details: [
          {
            field: 'email',
            message: expect.any(String),
          },
        ],
        message: 'Validation failed.',
      },
    });
    expect(resendOtp).not.toHaveBeenCalled();
  });

  it('returns a missing OTP error envelope when no OTP exists', async () => {
    const resendOtp = vi
      .fn<OtpResendUseCase['resendOtp']>()
      .mockRejectedValue(new OtpResendMissingError());
    const app = createApp({
      otp: {
        resendService: {
          resendOtp,
        },
      },
    });

    const response = await request(app).post('/otp/resend').send({ email: 'person@example.com' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_MISSING',
        message: 'No OTP exists for this email.',
      },
    });
  });

  it('returns a resend window error envelope when the window has expired', async () => {
    const resendOtp = vi
      .fn<OtpResendUseCase['resendOtp']>()
      .mockRejectedValue(new OtpResendWindowExpiredError(5, new Date('2026-05-24T12:00:00.000Z')));
    const app = createApp({
      otp: {
        resendService: {
          resendOtp,
        },
      },
    });

    const response = await request(app).post('/otp/resend').send({ email: 'person@example.com' });

    expect(response.status).toBe(410);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_EXPIRED',
        details: {
          resendAvailableUntil: '2026-05-24T12:00:00.000Z',
          resendWindowMinutes: 5,
        },
        message: 'OTP resend window has expired.',
      },
    });
  });

  it('returns a resend limit error envelope when the maximum count is reached', async () => {
    const resendOtp = vi
      .fn<OtpResendUseCase['resendOtp']>()
      .mockRejectedValue(new OtpResendLimitError(3));
    const app = createApp({
      otp: {
        resendService: {
          resendOtp,
        },
      },
    });

    const response = await request(app).post('/otp/resend').send({ email: 'person@example.com' });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_RESEND_LIMITED',
        details: {
          maxResends: 3,
        },
        message: 'OTP resend limit exceeded.',
      },
    });
  });

  it('returns a reused OTP error envelope when the latest OTP has been verified', async () => {
    const resendOtp = vi
      .fn<OtpResendUseCase['resendOtp']>()
      .mockRejectedValue(new OtpResendReusedError());
    const app = createApp({
      otp: {
        resendService: {
          resendOtp,
        },
      },
    });

    const response = await request(app).post('/otp/resend').send({ email: 'person@example.com' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_REUSED',
        message: 'OTP has already been verified.',
      },
    });
  });
});

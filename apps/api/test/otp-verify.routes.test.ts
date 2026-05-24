import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import type { OtpVerifyUseCase } from '../src/controllers/otp-verify.controller.js';
import {
  OtpVerifyExpiredError,
  OtpVerifyIncorrectError,
  OtpVerifyMissingError,
  OtpVerifyReusedError,
  OtpVerifySupersededError,
} from '../src/services/otp-verify.service.js';

describe('POST /otp/verify', () => {
  it('returns the shared success envelope for a valid verification', async () => {
    const verifyOtp = vi.fn<OtpVerifyUseCase['verifyOtp']>().mockResolvedValue({
      email: 'person@example.com',
      verifiedAt: '2026-05-24T12:00:00.000Z',
    });
    const app = createApp({
      otp: {
        verifyService: {
          verifyOtp,
        },
      },
    });

    const response = await request(app).post('/otp/verify').send({
      code: '123456',
      email: ' Person@Example.com ',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        email: 'person@example.com',
        verifiedAt: '2026-05-24T12:00:00.000Z',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('123456');
    expect(verifyOtp).toHaveBeenCalledWith({
      code: '123456',
      email: 'person@example.com',
    });
  });

  it('returns the shared validation error envelope for invalid email and code values', async () => {
    const verifyOtp = vi.fn<OtpVerifyUseCase['verifyOtp']>();
    const app = createApp({
      otp: {
        verifyService: {
          verifyOtp,
        },
      },
    });

    const response = await request(app).post('/otp/verify').send({
      code: '12ab',
      email: 'not-an-email',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        details: expect.arrayContaining([
          {
            field: 'email',
            message: expect.any(String),
          },
          {
            field: 'code',
            message: expect.any(String),
          },
        ]),
        message: 'Validation failed.',
      },
    });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('returns a missing OTP error envelope when no OTP exists', async () => {
    const verifyOtp = vi
      .fn<OtpVerifyUseCase['verifyOtp']>()
      .mockRejectedValue(new OtpVerifyMissingError());
    const app = createApp({
      otp: {
        verifyService: {
          verifyOtp,
        },
      },
    });

    const response = await request(app).post('/otp/verify').send({
      code: '123456',
      email: 'person@example.com',
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_MISSING',
        message: 'No OTP exists for this email.',
      },
    });
  });

  it('returns a superseded OTP error envelope for older codes', async () => {
    const verifyOtp = vi
      .fn<OtpVerifyUseCase['verifyOtp']>()
      .mockRejectedValue(new OtpVerifySupersededError());
    const app = createApp({
      otp: {
        verifyService: {
          verifyOtp,
        },
      },
    });

    const response = await request(app).post('/otp/verify').send({
      code: '123456',
      email: 'person@example.com',
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_SUPERSEDED',
        message: 'OTP has been superseded.',
      },
    });
  });

  it('returns an expired OTP error envelope', async () => {
    const verifyOtp = vi
      .fn<OtpVerifyUseCase['verifyOtp']>()
      .mockRejectedValue(new OtpVerifyExpiredError(new Date('2026-05-24T12:00:00.000Z')));
    const app = createApp({
      otp: {
        verifyService: {
          verifyOtp,
        },
      },
    });

    const response = await request(app).post('/otp/verify').send({
      code: '123456',
      email: 'person@example.com',
    });

    expect(response.status).toBe(410);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_EXPIRED',
        details: {
          expiresAt: '2026-05-24T12:00:00.000Z',
        },
        message: 'OTP has expired.',
      },
    });
  });

  it('returns a reused OTP error envelope', async () => {
    const verifyOtp = vi
      .fn<OtpVerifyUseCase['verifyOtp']>()
      .mockRejectedValue(new OtpVerifyReusedError());
    const app = createApp({
      otp: {
        verifyService: {
          verifyOtp,
        },
      },
    });

    const response = await request(app).post('/otp/verify').send({
      code: '123456',
      email: 'person@example.com',
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_REUSED',
        message: 'OTP has already been verified.',
      },
    });
  });

  it('returns an incorrect OTP error envelope', async () => {
    const verifyOtp = vi
      .fn<OtpVerifyUseCase['verifyOtp']>()
      .mockRejectedValue(new OtpVerifyIncorrectError());
    const app = createApp({
      otp: {
        verifyService: {
          verifyOtp,
        },
      },
    });

    const response = await request(app).post('/otp/verify').send({
      code: '123456',
      email: 'person@example.com',
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_INCORRECT',
        message: 'OTP code is incorrect.',
      },
    });
  });
});

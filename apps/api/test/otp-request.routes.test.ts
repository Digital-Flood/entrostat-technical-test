import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import type { OtpRequestUseCase } from '../src/controllers/otp-request.controller.js';

describe('POST /otp/request', () => {
  it('returns the shared success envelope for a valid request', async () => {
    const requestOtp = vi.fn<OtpRequestUseCase['requestOtp']>().mockResolvedValue({
      delivery: {
        mode: 'demo',
        status: 'captured',
      },
      email: 'person@example.com',
      expiresAt: '2026-05-24T12:05:00.000Z',
      expiresInSeconds: 300,
    });
    const app = createApp({
      otp: {
        requestService: {
          requestOtp,
        },
      },
    });

    const response = await request(app)
      .post('/otp/request')
      .send({ email: ' Person@Example.com ' });

    expect(response.status).toBe(201);
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
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('654321');
    expect(requestOtp).toHaveBeenCalledWith({ email: 'person@example.com' });
  });

  it('returns the shared validation error envelope for an invalid email', async () => {
    const requestOtp = vi.fn<OtpRequestUseCase['requestOtp']>();
    const app = createApp({
      otp: {
        requestService: {
          requestOtp,
        },
      },
    });

    const response = await request(app).post('/otp/request').send({ email: 'not-an-email' });

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
    expect(requestOtp).not.toHaveBeenCalled();
  });
});

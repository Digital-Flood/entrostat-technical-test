import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { DemoOtpDeliveryStore } from '../src/delivery/otp-delivery.adapter.js';
import { DevOtpInboxService } from '../src/services/dev-otp-inbox.service.js';

describe('GET /dev/otp-inbox', () => {
  it('returns captured demo deliveries in the shared success envelope', async () => {
    const store = new DemoOtpDeliveryStore();
    store.capture(
      {
        code: '123456',
        email: 'person@example.com',
        expiresAt: new Date('2026-05-24T12:05:00.000Z'),
        issueReason: 'REQUEST',
        otpRecordId: 'otp_1',
      },
      new Date('2026-05-24T12:00:00.000Z'),
    );
    const app = createApp({
      dev: {
        inboxService: new DevOtpInboxService({
          config: {
            deliveryMode: 'demo',
          },
          store,
        }),
      },
    });

    const response = await request(app).get('/dev/otp-inbox');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        deliveries: [
          {
            code: '123456',
            deliveredAt: '2026-05-24T12:00:00.000Z',
            email: 'person@example.com',
            expiresAt: '2026-05-24T12:05:00.000Z',
            issueReason: 'REQUEST',
            otpRecordId: 'otp_1',
          },
        ],
        deliveryMode: 'demo',
      },
    });
  });

  it('hides the inbox outside demo delivery mode', async () => {
    const store = new DemoOtpDeliveryStore();
    store.capture({
      code: '123456',
      email: 'person@example.com',
      expiresAt: new Date('2026-05-24T12:05:00.000Z'),
      issueReason: 'REQUEST',
      otpRecordId: 'otp_1',
    });
    const app = createApp({
      dev: {
        inboxService: new DevOtpInboxService({
          config: {
            deliveryMode: 'production',
          },
          store,
        }),
      },
    });

    const response = await request(app).get('/dev/otp-inbox');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Demo OTP inbox is not available.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('123456');
  });
});

import { describe, expect, it } from 'vitest';

import {
  createOtpDeliveryAdapter,
  ProductionOtpDeliveryAdapter,
  ResendHttpEmailClient,
  type OtpEmailMessage,
} from './otp-delivery.adapter.js';

describe('createOtpDeliveryAdapter', () => {
  it('fails safely when production delivery is missing required configuration', () => {
    expect(() =>
      createOtpDeliveryAdapter({
        codeLength: 6,
        deliveryMode: 'production',
        emailFrom: undefined,
        resendApiKey: undefined,
      }),
    ).toThrow('Production OTP delivery requires RESEND_API_KEY and OTP_EMAIL_FROM.');
  });
});

describe('ProductionOtpDeliveryAdapter', () => {
  it('sends the OTP through the configured email client without changing API response metadata', async () => {
    const sentMessages: OtpEmailMessage[] = [];
    const adapter = new ProductionOtpDeliveryAdapter(
      {
        emailFrom: 'Entrostat OTP <otp@example.com>',
        resendApiKey: 'resend_test_key',
      },
      {
        async send(message) {
          sentMessages.push(message);
        },
      },
    );

    const result = await adapter.deliver({
      code: '123456',
      email: 'person@example.com',
      expiresAt: new Date('2026-05-24T12:05:00.000Z'),
      issueReason: 'REQUEST',
      otpRecordId: 'otp_1',
    });

    expect(result).toEqual({
      mode: 'production',
      status: 'queued',
    });
    expect(sentMessages).toEqual([
      {
        from: 'Entrostat OTP <otp@example.com>',
        html: expect.stringContaining('Use this code to complete your OTP Guard verification.'),
        subject: 'Your OTP Guard code',
        text: [
          'Your OTP Guard code is 123456.',
          'It expires at 24 May 2026, 12:05 UTC.',
          'If you did not request this code, ignore this email.',
        ].join('\n\n'),
        to: 'person@example.com',
      },
    ]);
    expect(sentMessages[0]?.html).toContain('OTP Guard');
    expect(sentMessages[0]?.html).toContain('123456');
    expect(sentMessages[0]?.html).toContain('24 May 2026, 12:05 UTC');
    expect(sentMessages[0]?.html).toContain(
      'If you did not request this code, you can safely ignore this email.',
    );
  });
});

describe('ResendHttpEmailClient', () => {
  it('posts email payloads with HTML to the Resend email API', async () => {
    const requests: unknown[] = [];
    const client = new ResendHttpEmailClient('resend_test_key', async (url, init) => {
      requests.push({ init, url });

      return {
        ok: true,
        status: 200,
        async text() {
          return '';
        },
      };
    });

    await client.send({
      from: 'Entrostat OTP <otp@example.com>',
      html: '<p>Your OTP Guard code is <strong>123456</strong>.</p>',
      subject: 'Your OTP Guard code',
      text: 'Your OTP Guard code is 123456.',
      to: 'person@example.com',
    });

    expect(requests).toEqual([
      {
        init: {
          body: JSON.stringify({
            from: 'Entrostat OTP <otp@example.com>',
            html: '<p>Your OTP Guard code is <strong>123456</strong>.</p>',
            subject: 'Your OTP Guard code',
            text: 'Your OTP Guard code is 123456.',
            to: 'person@example.com',
          }),
          headers: {
            Authorization: 'Bearer resend_test_key',
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
        url: 'https://api.resend.com/emails',
      },
    ]);
  });

  it('omits HTML from the Resend email API payload when it is not provided', async () => {
    const requests: unknown[] = [];
    const client = new ResendHttpEmailClient('resend_test_key', async (url, init) => {
      requests.push({ init, url });

      return {
        ok: true,
        status: 200,
        async text() {
          return '';
        },
      };
    });

    await client.send({
      from: 'Entrostat OTP <otp@example.com>',
      subject: 'Your OTP Guard code',
      text: 'Your OTP Guard code is 123456.',
      to: 'person@example.com',
    });

    expect(requests).toEqual([
      {
        init: {
          body: JSON.stringify({
            from: 'Entrostat OTP <otp@example.com>',
            subject: 'Your OTP Guard code',
            text: 'Your OTP Guard code is 123456.',
            to: 'person@example.com',
          }),
          headers: {
            Authorization: 'Bearer resend_test_key',
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
        url: 'https://api.resend.com/emails',
      },
    ]);
  });

  it('raises a safe error when Resend rejects the email request', async () => {
    const client = new ResendHttpEmailClient('resend_test_key', async () => ({
      ok: false,
      status: 401,
      async text() {
        return 'unauthorised';
      },
    }));

    await expect(
      client.send({
        from: 'Entrostat OTP <otp@example.com>',
        subject: 'Your OTP Guard code',
        text: 'Your OTP Guard code is 123456.',
        to: 'person@example.com',
      }),
    ).rejects.toThrow('Resend email delivery failed with status 401: unauthorised');
  });
});

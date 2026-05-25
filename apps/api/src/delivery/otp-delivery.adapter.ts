import type { OtpIssueReason } from '@prisma/client';

import type { OtpConfig, OtpDeliveryMode } from '../config/otp.config.js';

export type OtpDeliveryStatus = 'captured' | 'queued';

export type OtpDeliveryRequest = {
  code: string;
  email: string;
  expiresAt: Date;
  issueReason: OtpIssueReason;
  otpRecordId: string;
};

export type OtpDeliveryResult = {
  mode: OtpDeliveryMode;
  status: OtpDeliveryStatus;
};

export type OtpEmailMessage = {
  from: string;
  html?: string;
  subject: string;
  text: string;
  to: string;
};

export interface OtpEmailClient {
  send(message: OtpEmailMessage): Promise<void>;
}

export interface OtpDeliveryAdapter {
  deliver(request: OtpDeliveryRequest): Promise<OtpDeliveryResult>;
}

export type DemoOtpDelivery = OtpDeliveryRequest & {
  deliveredAt: Date;
};

export class DemoOtpDeliveryStore {
  private readonly deliveries: DemoOtpDelivery[] = [];

  capture(delivery: OtpDeliveryRequest, deliveredAt = new Date()): DemoOtpDelivery {
    const capturedDelivery = {
      ...delivery,
      deliveredAt,
    };

    this.deliveries.unshift(capturedDelivery);

    return capturedDelivery;
  }

  list(): DemoOtpDelivery[] {
    return [...this.deliveries];
  }

  clear(): void {
    this.deliveries.length = 0;
  }
}

export class DemoOtpDeliveryAdapter implements OtpDeliveryAdapter {
  constructor(private readonly store: DemoOtpDeliveryStore = demoOtpDeliveryStore) {}

  async deliver(request: OtpDeliveryRequest): Promise<OtpDeliveryResult> {
    this.store.capture(request);

    return {
      mode: 'demo',
      status: 'captured',
    };
  }
}

export class ProductionOtpDeliveryAdapter implements OtpDeliveryAdapter {
  private readonly emailClient: OtpEmailClient;
  private readonly emailFrom: string;

  constructor(
    private readonly config: Pick<OtpConfig, 'emailFrom' | 'resendApiKey'>,
    emailClient?: OtpEmailClient,
  ) {
    if (!this.config.resendApiKey || !this.config.emailFrom) {
      throw new Error('Production OTP delivery requires RESEND_API_KEY and OTP_EMAIL_FROM.');
    }

    this.emailFrom = this.config.emailFrom;
    this.emailClient = emailClient ?? new ResendHttpEmailClient(this.config.resendApiKey);
  }

  async deliver(request: OtpDeliveryRequest): Promise<OtpDeliveryResult> {
    const expiry = formatOtpExpiry(request.expiresAt);

    await this.emailClient.send({
      from: this.emailFrom,
      html: createOtpEmailHtml(request, expiry),
      subject: 'Your OTP Guard code',
      text: createOtpEmailText(request, expiry),
      to: request.email,
    });

    return {
      mode: 'production',
      status: 'queued',
    };
  }
}

type ResendFetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

type ResendFetch = (
  url: string,
  init: {
    body: string;
    headers: Record<string, string>;
    method: 'POST';
  },
) => Promise<ResendFetchResponse>;

export class ResendHttpEmailClient implements OtpEmailClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: ResendFetch = globalThis.fetch.bind(globalThis) as ResendFetch,
  ) {}

  async send(message: OtpEmailMessage): Promise<void> {
    const response = await this.fetcher('https://api.resend.com/emails', {
      body: JSON.stringify({
        from: message.from,
        ...(message.html ? { html: message.html } : {}),
        subject: message.subject,
        text: message.text,
        to: message.to,
      }),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `Resend email delivery failed with status ${response.status}${responseText ? `: ${responseText}` : '.'}`,
      );
    }
  }
}

function createOtpEmailText(
  request: OtpDeliveryRequest,
  expiry = formatOtpExpiry(request.expiresAt),
): string {
  return [
    `Your OTP Guard code is ${request.code}.`,
    `It expires at ${expiry}.`,
    'If you did not request this code, ignore this email.',
  ].join('\n\n');
}

function createOtpEmailHtml(
  request: OtpDeliveryRequest,
  expiry = formatOtpExpiry(request.expiresAt),
): string {
  const code = escapeHtml(request.code);
  const formattedExpiry = escapeHtml(expiry);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Your OTP Guard code</title>
  </head>
  <body style="margin:0; padding:0; background-color:#0B1220; color:#E5E7EB; font-family:Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; background-color:#0B1220;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; max-width:600px; border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 16px 0; color:#60A5FA; font-size:12px; font-weight:700; letter-spacing:0.08em; line-height:16px; text-transform:uppercase;">
                OTP Guard
              </td>
            </tr>
            <tr>
              <td style="background-color:#0F172A; border:1px solid #334155; border-radius:18px; box-shadow:0 20px 48px rgba(2, 6, 23, 0.32); padding:32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="color:#E5E7EB; font-size:24px; font-weight:700; line-height:32px; padding:0 0 12px 0;">
                      Your verification code
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#9CA3AF; font-size:15px; line-height:24px; padding:0 0 24px 0;">
                      Use this code to complete your OTP Guard verification.
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="background-color:#111827; border:1px solid #334155; border-radius:14px; color:#F8FAFC; font-size:34px; font-weight:800; letter-spacing:0.24em; line-height:44px; padding:20px 18px;">
                      ${code}
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#CBD5E1; font-size:14px; line-height:22px; padding:24px 0 0 0;">
                      This code expires at <strong style="color:#E5E7EB; font-weight:700;">${formattedExpiry}</strong>.
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#94A3B8; font-size:13px; line-height:20px; padding:18px 0 0 0;">
                      If you did not request this code, you can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatOtpExpiry(expiresAt: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    timeZoneName: 'short',
    year: 'numeric',
  }).format(expiresAt);
}

export const demoOtpDeliveryStore = new DemoOtpDeliveryStore();

export function createOtpDeliveryAdapter(config: OtpConfig): OtpDeliveryAdapter {
  if (config.deliveryMode === 'demo') {
    return new DemoOtpDeliveryAdapter();
  }

  return new ProductionOtpDeliveryAdapter(config);
}

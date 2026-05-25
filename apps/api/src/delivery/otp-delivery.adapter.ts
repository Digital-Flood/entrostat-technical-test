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
    await this.emailClient.send({
      from: this.emailFrom,
      subject: 'Your OTP Guard code',
      text: createOtpEmailText(request),
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

function createOtpEmailText(request: OtpDeliveryRequest): string {
  return [
    `Your OTP Guard code is ${request.code}.`,
    `It expires at ${formatOtpExpiry(request.expiresAt)}.`,
    'If you did not request this code, ignore this email.',
  ].join('\n\n');
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

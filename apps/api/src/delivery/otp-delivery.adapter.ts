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
  constructor(private readonly config: Pick<OtpConfig, 'emailFrom' | 'resendApiKey'>) {
    if (!this.config.resendApiKey || !this.config.emailFrom) {
      throw new Error('Production OTP delivery requires RESEND_API_KEY and OTP_EMAIL_FROM.');
    }
  }

  async deliver(): Promise<OtpDeliveryResult> {
    throw new Error('Production OTP delivery is not implemented yet.');
  }
}

export const demoOtpDeliveryStore = new DemoOtpDeliveryStore();

export function createOtpDeliveryAdapter(config: OtpConfig): OtpDeliveryAdapter {
  if (config.deliveryMode === 'demo') {
    return new DemoOtpDeliveryAdapter();
  }

  return new ProductionOtpDeliveryAdapter(config);
}

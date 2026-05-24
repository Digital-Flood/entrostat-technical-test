import type { OtpIssueReason } from '@prisma/client';

import type { OtpConfig } from '../config/otp.config.js';
import { getOtpConfig } from '../config/otp.config.js';
import {
  demoOtpDeliveryStore,
  type DemoOtpDeliveryStore,
} from '../delivery/otp-delivery.adapter.js';

export type DevOtpInboxDelivery = {
  code: string;
  deliveredAt: string;
  email: string;
  expiresAt: string;
  issueReason: OtpIssueReason;
  otpRecordId: string;
};

export type DevOtpInboxResult = {
  deliveries: DevOtpInboxDelivery[];
  deliveryMode: 'demo';
};

export type DevOtpInboxServiceDependencies = {
  config?: Pick<OtpConfig, 'deliveryMode'>;
  store?: DemoOtpDeliveryStore;
};

export class DevOtpInboxUnavailableError extends Error {
  constructor() {
    super('Demo OTP inbox is not available.');
  }
}

export class DevOtpInboxService {
  private readonly config: Pick<OtpConfig, 'deliveryMode'>;
  private readonly store: DemoOtpDeliveryStore;

  constructor(dependencies: DevOtpInboxServiceDependencies = {}) {
    this.config = dependencies.config ?? getOtpConfig();
    this.store = dependencies.store ?? demoOtpDeliveryStore;
  }

  listDeliveries(): DevOtpInboxResult {
    if (this.config.deliveryMode !== 'demo') {
      throw new DevOtpInboxUnavailableError();
    }

    return {
      deliveries: this.store.list().map((delivery) => ({
        code: delivery.code,
        deliveredAt: delivery.deliveredAt.toISOString(),
        email: delivery.email,
        expiresAt: delivery.expiresAt.toISOString(),
        issueReason: delivery.issueReason,
        otpRecordId: delivery.otpRecordId,
      })),
      deliveryMode: 'demo',
    };
  }
}

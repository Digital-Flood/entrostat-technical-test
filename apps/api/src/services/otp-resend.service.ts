import type { OtpRecord } from '@prisma/client';

import type { OtpConfig, OtpRuleSettings } from '../config/otp.config.js';
import { getOtpConfig } from '../config/otp.config.js';
import {
  createOtpDeliveryAdapter,
  type OtpDeliveryAdapter,
  type OtpDeliveryResult,
} from '../delivery/otp-delivery.adapter.js';
import type { CreateOtpRecordInput, SupersedeActiveInput } from '../repositories/otp.repository.js';
import {
  OtpResendLimitError,
  OtpResendMissingError,
  OtpResendReusedError,
  OtpResendWindowExpiredError,
} from './otp-resend.errors.js';
import { otpSettingsService, type OtpSettingsProvider } from './otp-settings.service.js';

export type OtpResendInput = {
  email: string;
};

export type OtpResendResult = {
  delivery: OtpDeliveryResult;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
  resendCount: number;
};

export type OtpResendRepository = {
  countResendsForRequestGroup(requestGroupId: string): Promise<number>;
  create(data: CreateOtpRecordInput): Promise<OtpRecord>;
  findLatestByEmail(email: string): Promise<OtpRecord | null>;
  supersedeActiveForEmail(input: SupersedeActiveInput): Promise<{ count: number }>;
};

type OtpResendConfig = Pick<OtpConfig, 'codeLength'> &
  Partial<Pick<OtpRuleSettings, 'expirySeconds' | 'maxResends' | 'resendWindowMinutes'>>;

export type OtpResendServiceDependencies = {
  config?: OtpResendConfig;
  delivery?: OtpDeliveryAdapter;
  generateCode?: (length: number) => string;
  now?: () => Date;
  repository: OtpResendRepository;
  settingsProvider?: Pick<OtpSettingsProvider, 'getSettings'>;
  withTransaction?: <Result>(
    operation: (repository: OtpResendRepository) => Promise<Result>,
  ) => Promise<Result>;
};

export class OtpResendService {
  private readonly delivery: OtpDeliveryAdapter;
  private readonly now: () => Date;
  private readonly repository: OtpResendRepository;
  private readonly settingsProvider: Pick<OtpSettingsProvider, 'getSettings'>;
  private readonly withTransaction: <Result>(
    operation: (repository: OtpResendRepository) => Promise<Result>,
  ) => Promise<Result>;

  constructor(dependencies: OtpResendServiceDependencies) {
    const config = dependencies.config ?? getOtpConfig();

    this.delivery = dependencies.delivery ?? createOtpDeliveryAdapter(getOtpConfig());
    this.now = dependencies.now ?? (() => new Date());
    this.repository = dependencies.repository;
    this.settingsProvider = dependencies.settingsProvider ?? createSettingsProvider(config);
    this.withTransaction =
      dependencies.withTransaction ?? ((operation) => operation(this.repository));
  }

  async resendOtp(input: OtpResendInput): Promise<OtpResendResult> {
    const settings = this.settingsProvider.getSettings();
    const issuedAt = this.now();
    const expiresAt = new Date(issuedAt.getTime() + settings.expirySeconds * 1000);

    const record = await this.withTransaction(async (repository) => {
      const latestRecord = await repository.findLatestByEmail(input.email);

      if (!latestRecord) {
        throw new OtpResendMissingError();
      }

      if (latestRecord.status === 'VERIFIED' || latestRecord.verifiedAt !== null) {
        throw new OtpResendReusedError();
      }

      const resendAvailableUntil = this.getResendAvailableUntil(latestRecord, settings);

      if (issuedAt > resendAvailableUntil) {
        throw new OtpResendWindowExpiredError(settings.resendWindowMinutes, resendAvailableUntil);
      }

      const resendCount = await repository.countResendsForRequestGroup(latestRecord.requestGroupId);

      if (resendCount >= settings.maxResends) {
        throw new OtpResendLimitError(settings.maxResends);
      }

      const nextResendCount = Math.max(latestRecord.resendCount, resendCount) + 1;
      const createdRecord = await repository.create(
        this.createOtpRecordInput(input.email, expiresAt, latestRecord, nextResendCount),
      );

      await repository.supersedeActiveForEmail({
        email: input.email,
        supersededAt: issuedAt,
        supersededById: createdRecord.id,
      });

      return createdRecord;
    });

    const delivery = await this.delivery.deliver({
      code: record.code,
      email: record.email,
      expiresAt: record.expiresAt,
      issueReason: record.issueReason,
      otpRecordId: record.id,
    });

    return this.toResult(record, delivery, settings);
  }

  private createOtpRecordInput(
    email: string,
    expiresAt: Date,
    latestRecord: OtpRecord,
    resendCount: number,
  ): CreateOtpRecordInput {
    return {
      code: latestRecord.code,
      email,
      expiresAt,
      issueReason: 'RESEND',
      requestGroupId: latestRecord.requestGroupId,
      resendCount,
      status: 'ACTIVE',
    };
  }

  private getResendAvailableUntil(
    record: OtpRecord,
    settings: Pick<OtpRuleSettings, 'resendWindowMinutes'>,
  ): Date {
    return new Date(record.createdAt.getTime() + settings.resendWindowMinutes * 60 * 1000);
  }

  private toResult(
    record: OtpRecord,
    delivery: OtpDeliveryResult,
    settings: Pick<OtpRuleSettings, 'expirySeconds'>,
  ): OtpResendResult {
    return {
      delivery,
      email: record.email,
      expiresAt: record.expiresAt.toISOString(),
      expiresInSeconds: settings.expirySeconds,
      resendCount: record.resendCount,
    };
  }
}

function createSettingsProvider(config: OtpResendConfig): Pick<OtpSettingsProvider, 'getSettings'> {
  if (
    typeof config.expirySeconds === 'number' &&
    typeof config.maxResends === 'number' &&
    typeof config.resendWindowMinutes === 'number'
  ) {
    const expirySeconds = config.expirySeconds;
    const maxResends = config.maxResends;
    const resendWindowMinutes = config.resendWindowMinutes;

    return {
      getSettings: () => ({
        ...otpSettingsService.getSettings(),
        expirySeconds,
        maxResends,
        resendWindowMinutes,
      }),
    };
  }

  return otpSettingsService;
}

export {
  OtpResendLimitError,
  OtpResendMissingError,
  OtpResendReusedError,
  OtpResendWindowExpiredError,
} from './otp-resend.errors.js';

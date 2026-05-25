import type { OtpRecord } from '@prisma/client';

import type { OtpConfig, OtpRuleSettings } from '../config/otp.config.js';
import { getOtpConfig } from '../config/otp.config.js';
import {
  createOtpDeliveryAdapter,
  type OtpDeliveryAdapter,
  type OtpDeliveryResult,
} from '../delivery/otp-delivery.adapter.js';
import type {
  CreateOtpRecordInput,
  EmailAndCodeSinceLookup,
  SupersedeActiveInput,
} from '../repositories/otp.repository.js';
import { generateNumericOtpCode } from './otp-code-generator.js';
import { OtpRequestRateLimitError } from './otp-request.errors.js';
import { otpSettingsService, type OtpSettingsProvider } from './otp-settings.service.js';

export type OtpRequestInput = {
  email: string;
};

export type OtpRequestResult = {
  delivery: OtpDeliveryResult;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
};

export type OtpRequestRepository = {
  countRequestsCreatedSince(email: string, since: Date): Promise<number>;
  create(data: CreateOtpRecordInput): Promise<OtpRecord>;
  findByEmailAndCodeCreatedSince(input: EmailAndCodeSinceLookup): Promise<OtpRecord | null>;
  supersedeActiveForEmail(input: SupersedeActiveInput): Promise<{ count: number }>;
};

type OtpRequestConfig = Pick<OtpConfig, 'codeLength'> &
  Partial<Pick<OtpRuleSettings, 'expirySeconds' | 'maxRequestsPerHour'>>;

export type OtpRequestServiceDependencies = {
  config?: OtpRequestConfig;
  delivery?: OtpDeliveryAdapter;
  generateCode?: (length: number) => string;
  now?: () => Date;
  repository: OtpRequestRepository;
  settingsProvider?: Pick<OtpSettingsProvider, 'getSettings'>;
  withTransaction?: <Result>(
    operation: (repository: OtpRequestRepository) => Promise<Result>,
  ) => Promise<Result>;
};

export class OtpRequestService {
  private readonly codeLength: number;
  private readonly delivery: OtpDeliveryAdapter;
  private readonly generateCode: (length: number) => string;
  private readonly now: () => Date;
  private readonly repository: OtpRequestRepository;
  private readonly settingsProvider: Pick<OtpSettingsProvider, 'getSettings'>;
  private readonly withTransaction: <Result>(
    operation: (repository: OtpRequestRepository) => Promise<Result>,
  ) => Promise<Result>;

  constructor(dependencies: OtpRequestServiceDependencies) {
    const config = dependencies.config ?? getOtpConfig();

    this.codeLength = config.codeLength;
    this.delivery = dependencies.delivery ?? createOtpDeliveryAdapter(getOtpConfig());
    this.generateCode = dependencies.generateCode ?? generateNumericOtpCode;
    this.now = dependencies.now ?? (() => new Date());
    this.repository = dependencies.repository;
    this.settingsProvider = dependencies.settingsProvider ?? createSettingsProvider(config);
    this.withTransaction =
      dependencies.withTransaction ?? ((operation) => operation(this.repository));
  }

  async requestOtp(input: OtpRequestInput): Promise<OtpRequestResult> {
    const settings = this.settingsProvider.getSettings();
    const issuedAt = this.now();
    const oneHourAgo = new Date(issuedAt.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(issuedAt.getTime() - 24 * 60 * 60 * 1000);
    const expiresAt = new Date(issuedAt.getTime() + settings.expirySeconds * 1000);

    const record = await this.withTransaction(async (repository) => {
      const requestCount = await repository.countRequestsCreatedSince(input.email, oneHourAgo);

      if (requestCount >= settings.maxRequestsPerHour) {
        throw new OtpRequestRateLimitError(settings.maxRequestsPerHour);
      }

      const code = await this.generateUniqueCode(repository, input.email, twentyFourHoursAgo);
      const createdRecord = await repository.create(
        this.createOtpRecordInput(input.email, code, expiresAt),
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

  private createOtpRecordInput(email: string, code: string, expiresAt: Date): CreateOtpRecordInput {
    return {
      code,
      email,
      expiresAt,
      issueReason: 'REQUEST',
      resendCount: 0,
      status: 'ACTIVE',
    };
  }

  private async generateUniqueCode(
    repository: OtpRequestRepository,
    email: string,
    since: Date,
  ): Promise<string> {
    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const code = this.generateCode(this.codeLength);
      const duplicate = await repository.findByEmailAndCodeCreatedSince({
        code,
        email,
        since,
      });

      if (!duplicate) {
        return code;
      }
    }

    throw new Error('Unable to generate a unique OTP code for the user.');
  }

  private toResult(
    record: OtpRecord,
    delivery: OtpDeliveryResult,
    settings: Pick<OtpRuleSettings, 'expirySeconds'>,
  ): OtpRequestResult {
    return {
      delivery,
      email: record.email,
      expiresAt: record.expiresAt.toISOString(),
      expiresInSeconds: settings.expirySeconds,
    };
  }
}

function createSettingsProvider(
  config: OtpRequestConfig,
): Pick<OtpSettingsProvider, 'getSettings'> {
  if (typeof config.expirySeconds === 'number' && typeof config.maxRequestsPerHour === 'number') {
    const expirySeconds = config.expirySeconds;
    const maxRequestsPerHour = config.maxRequestsPerHour;

    return {
      getSettings: () => ({
        ...otpSettingsService.getSettings(),
        expirySeconds,
        maxRequestsPerHour,
      }),
    };
  }

  return otpSettingsService;
}

export { OtpRequestRateLimitError } from './otp-request.errors.js';

import type { OtpRecord } from '@prisma/client';

import type { OtpConfig } from '../config/otp.config.js';
import { getOtpConfig } from '../config/otp.config.js';
import {
  createOtpDeliveryAdapter,
  type OtpDeliveryAdapter,
  type OtpDeliveryResult,
} from '../delivery/otp-delivery.adapter.js';
import type { CreateOtpRecordInput, SupersedeActiveInput } from '../repositories/otp.repository.js';
import { generateNumericOtpCode } from './otp-code-generator.js';
import { OtpRequestRateLimitError } from './otp-request.errors.js';

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
  supersedeActiveForEmail(input: SupersedeActiveInput): Promise<{ count: number }>;
};

export type OtpRequestServiceDependencies = {
  config?: Pick<OtpConfig, 'codeLength' | 'expirySeconds' | 'maxRequestsPerHour'>;
  delivery?: OtpDeliveryAdapter;
  generateCode?: (length: number) => string;
  now?: () => Date;
  repository: OtpRequestRepository;
  withTransaction?: <Result>(
    operation: (repository: OtpRequestRepository) => Promise<Result>,
  ) => Promise<Result>;
};

export class OtpRequestService {
  private readonly config: Pick<OtpConfig, 'codeLength' | 'expirySeconds' | 'maxRequestsPerHour'>;
  private readonly delivery: OtpDeliveryAdapter;
  private readonly generateCode: (length: number) => string;
  private readonly now: () => Date;
  private readonly repository: OtpRequestRepository;
  private readonly withTransaction: <Result>(
    operation: (repository: OtpRequestRepository) => Promise<Result>,
  ) => Promise<Result>;

  constructor(dependencies: OtpRequestServiceDependencies) {
    this.config = dependencies.config ?? getOtpConfig();
    this.delivery = dependencies.delivery ?? createOtpDeliveryAdapter(getOtpConfig());
    this.generateCode = dependencies.generateCode ?? generateNumericOtpCode;
    this.now = dependencies.now ?? (() => new Date());
    this.repository = dependencies.repository;
    this.withTransaction =
      dependencies.withTransaction ?? ((operation) => operation(this.repository));
  }

  async requestOtp(input: OtpRequestInput): Promise<OtpRequestResult> {
    const issuedAt = this.now();
    const oneHourAgo = new Date(issuedAt.getTime() - 60 * 60 * 1000);
    const expiresAt = new Date(issuedAt.getTime() + this.config.expirySeconds * 1000);
    const code = this.generateCode(this.config.codeLength);

    const record = await this.withTransaction(async (repository) => {
      const requestCount = await repository.countRequestsCreatedSince(input.email, oneHourAgo);

      if (requestCount >= this.config.maxRequestsPerHour) {
        throw new OtpRequestRateLimitError(this.config.maxRequestsPerHour);
      }

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

    return this.toResult(record, delivery);
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

  private toResult(record: OtpRecord, delivery: OtpDeliveryResult): OtpRequestResult {
    return {
      delivery,
      email: record.email,
      expiresAt: record.expiresAt.toISOString(),
      expiresInSeconds: this.config.expirySeconds,
    };
  }
}

export { OtpRequestRateLimitError } from './otp-request.errors.js';

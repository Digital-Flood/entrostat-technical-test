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
import {
  OtpResendLimitError,
  OtpResendMissingError,
  OtpResendWindowExpiredError,
} from './otp-resend.errors.js';

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

type OtpResendConfig = Pick<
  OtpConfig,
  'codeLength' | 'expirySeconds' | 'maxResends' | 'resendWindowMinutes'
>;

export type OtpResendServiceDependencies = {
  config?: OtpResendConfig;
  delivery?: OtpDeliveryAdapter;
  generateCode?: (length: number) => string;
  now?: () => Date;
  repository: OtpResendRepository;
  withTransaction?: <Result>(
    operation: (repository: OtpResendRepository) => Promise<Result>,
  ) => Promise<Result>;
};

export class OtpResendService {
  private readonly config: OtpResendConfig;
  private readonly delivery: OtpDeliveryAdapter;
  private readonly generateCode: (length: number) => string;
  private readonly now: () => Date;
  private readonly repository: OtpResendRepository;
  private readonly withTransaction: <Result>(
    operation: (repository: OtpResendRepository) => Promise<Result>,
  ) => Promise<Result>;

  constructor(dependencies: OtpResendServiceDependencies) {
    this.config = dependencies.config ?? getOtpConfig();
    this.delivery = dependencies.delivery ?? createOtpDeliveryAdapter(getOtpConfig());
    this.generateCode = dependencies.generateCode ?? generateNumericOtpCode;
    this.now = dependencies.now ?? (() => new Date());
    this.repository = dependencies.repository;
    this.withTransaction =
      dependencies.withTransaction ?? ((operation) => operation(this.repository));
  }

  async resendOtp(input: OtpResendInput): Promise<OtpResendResult> {
    const issuedAt = this.now();
    const expiresAt = new Date(issuedAt.getTime() + this.config.expirySeconds * 1000);
    const code = this.generateCode(this.config.codeLength);

    const record = await this.withTransaction(async (repository) => {
      const latestRecord = await repository.findLatestByEmail(input.email);

      if (!latestRecord) {
        throw new OtpResendMissingError();
      }

      const resendAvailableUntil = this.getResendAvailableUntil(latestRecord);

      if (issuedAt > resendAvailableUntil) {
        throw new OtpResendWindowExpiredError(
          this.config.resendWindowMinutes,
          resendAvailableUntil,
        );
      }

      const resendCount = await repository.countResendsForRequestGroup(latestRecord.requestGroupId);

      if (resendCount >= this.config.maxResends) {
        throw new OtpResendLimitError(this.config.maxResends);
      }

      const nextResendCount = Math.max(latestRecord.resendCount, resendCount) + 1;
      const createdRecord = await repository.create(
        this.createOtpRecordInput(input.email, code, expiresAt, latestRecord, nextResendCount),
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

  private createOtpRecordInput(
    email: string,
    code: string,
    expiresAt: Date,
    latestRecord: OtpRecord,
    resendCount: number,
  ): CreateOtpRecordInput {
    return {
      code,
      email,
      expiresAt,
      issueReason: 'RESEND',
      requestGroupId: latestRecord.requestGroupId,
      resendCount,
      status: 'ACTIVE',
    };
  }

  private getResendAvailableUntil(record: OtpRecord): Date {
    return new Date(record.createdAt.getTime() + this.config.resendWindowMinutes * 60 * 1000);
  }

  private toResult(record: OtpRecord, delivery: OtpDeliveryResult): OtpResendResult {
    return {
      delivery,
      email: record.email,
      expiresAt: record.expiresAt.toISOString(),
      expiresInSeconds: this.config.expirySeconds,
      resendCount: record.resendCount,
    };
  }
}

export {
  OtpResendLimitError,
  OtpResendMissingError,
  OtpResendWindowExpiredError,
} from './otp-resend.errors.js';

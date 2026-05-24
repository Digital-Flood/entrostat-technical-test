import type { OtpRecord } from '@prisma/client';

import type { EmailAndCodeLookup, MarkVerifiedInput } from '../repositories/otp.repository.js';
import {
  OtpVerifyExpiredError,
  OtpVerifyIncorrectError,
  OtpVerifyMissingError,
  OtpVerifyReusedError,
  OtpVerifySupersededError,
} from './otp-verify.errors.js';

export type OtpVerifyInput = {
  code: string;
  email: string;
};

export type OtpVerifyResult = {
  email: string;
  verifiedAt: string;
};

export type OtpVerifyRepository = {
  findByEmailAndCode(input: EmailAndCodeLookup): Promise<OtpRecord | null>;
  findLatestByEmail(email: string): Promise<OtpRecord | null>;
  markVerifiedIfActive(input: MarkVerifiedInput): Promise<{ count: number }>;
};

export type OtpVerifyServiceDependencies = {
  now?: () => Date;
  repository: OtpVerifyRepository;
  withTransaction?: <Result>(
    operation: (repository: OtpVerifyRepository) => Promise<Result>,
  ) => Promise<Result>;
};

export class OtpVerifyService {
  private readonly now: () => Date;
  private readonly repository: OtpVerifyRepository;
  private readonly withTransaction: <Result>(
    operation: (repository: OtpVerifyRepository) => Promise<Result>,
  ) => Promise<Result>;

  constructor(dependencies: OtpVerifyServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.repository = dependencies.repository;
    this.withTransaction =
      dependencies.withTransaction ?? ((operation) => operation(this.repository));
  }

  async verifyOtp(input: OtpVerifyInput): Promise<OtpVerifyResult> {
    const verifiedAt = this.now();

    const record = await this.withTransaction(async (repository) => {
      const latestRecord = await repository.findLatestByEmail(input.email);

      if (!latestRecord) {
        throw new OtpVerifyMissingError();
      }

      if (latestRecord.status === 'SUPERSEDED') {
        throw new OtpVerifySupersededError();
      }

      if (latestRecord.status === 'VERIFIED' || latestRecord.verifiedAt !== null) {
        throw new OtpVerifyReusedError();
      }

      if (latestRecord.status === 'EXPIRED' || verifiedAt >= latestRecord.expiresAt) {
        throw new OtpVerifyExpiredError(latestRecord.expiresAt);
      }

      if (latestRecord.code !== input.code) {
        await this.rejectSupersededOrIncorrect(repository, input, latestRecord);
      }

      const updateResult = await repository.markVerifiedIfActive({
        id: latestRecord.id,
        verifiedAt,
      });

      if (updateResult.count !== 1) {
        throw new OtpVerifyReusedError();
      }

      return latestRecord;
    });

    return {
      email: record.email,
      verifiedAt: verifiedAt.toISOString(),
    };
  }

  private async rejectSupersededOrIncorrect(
    repository: OtpVerifyRepository,
    input: OtpVerifyInput,
    latestRecord: OtpRecord,
  ): Promise<never> {
    const matchingRecord = await repository.findByEmailAndCode({
      code: input.code,
      email: input.email,
    });

    if (matchingRecord && matchingRecord.id !== latestRecord.id) {
      throw new OtpVerifySupersededError();
    }

    throw new OtpVerifyIncorrectError();
  }
}

export {
  OtpVerifyExpiredError,
  OtpVerifyIncorrectError,
  OtpVerifyMissingError,
  OtpVerifyReusedError,
  OtpVerifySupersededError,
} from './otp-verify.errors.js';

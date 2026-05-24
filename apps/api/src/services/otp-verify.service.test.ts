import type { OtpRecord } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { EmailAndCodeLookup, MarkVerifiedInput } from '../repositories/otp.repository.js';
import {
  OtpVerifyExpiredError,
  OtpVerifyIncorrectError,
  OtpVerifyMissingError,
  OtpVerifyReusedError,
  OtpVerifyService,
  OtpVerifySupersededError,
  type OtpVerifyRepository,
} from './otp-verify.service.js';

class FakeOtpRepository implements OtpVerifyRepository {
  readonly records: OtpRecord[] = [];
  failConditionalVerification = false;

  constructor(seedRecords: OtpRecord[] = []) {
    this.records.push(...seedRecords);
  }

  async findLatestByEmail(email: string): Promise<OtpRecord | null> {
    return (
      this.records
        .filter((record) => record.email === email)
        .sort((left, right) => {
          const createdAtDifference = right.createdAt.getTime() - left.createdAt.getTime();

          if (createdAtDifference !== 0) {
            return createdAtDifference;
          }

          return right.id.localeCompare(left.id);
        })[0] ?? null
    );
  }

  async findByEmailAndCode({ email, code }: EmailAndCodeLookup): Promise<OtpRecord | null> {
    return (
      this.records
        .filter((record) => record.email === email && record.code === code)
        .sort((left, right) => {
          const createdAtDifference = right.createdAt.getTime() - left.createdAt.getTime();

          if (createdAtDifference !== 0) {
            return createdAtDifference;
          }

          return right.id.localeCompare(left.id);
        })[0] ?? null
    );
  }

  async markVerifiedIfActive({ id, verifiedAt }: MarkVerifiedInput): Promise<{ count: number }> {
    if (this.failConditionalVerification) {
      return { count: 0 };
    }

    const record = this.records.find(
      (candidate) =>
        candidate.id === id && candidate.status === 'ACTIVE' && candidate.verifiedAt === null,
    );

    if (!record) {
      return { count: 0 };
    }

    record.status = 'VERIFIED';
    record.verifiedAt = verifiedAt;
    record.updatedAt = verifiedAt;

    return { count: 1 };
  }
}

const fixedNow = new Date('2026-05-24T12:00:00.000Z');

function createRecord(overrides: Partial<OtpRecord> = {}): OtpRecord {
  const createdAt = overrides.createdAt ?? new Date('2026-05-24T11:58:00.000Z');

  return {
    code: overrides.code ?? '123456',
    createdAt,
    email: overrides.email ?? 'person@example.com',
    expiresAt: overrides.expiresAt ?? new Date('2026-05-24T12:03:00.000Z'),
    id: overrides.id ?? '00000000-0000-0000-0000-000000000999',
    issueReason: overrides.issueReason ?? 'REQUEST',
    requestGroupId: overrides.requestGroupId ?? '10000000-0000-0000-0000-000000000999',
    resendCount: overrides.resendCount ?? 0,
    status: overrides.status ?? 'ACTIVE',
    supersededAt: overrides.supersededAt ?? null,
    supersededById: overrides.supersededById ?? null,
    updatedAt: overrides.updatedAt ?? createdAt,
    verifiedAt: overrides.verifiedAt ?? null,
  };
}

function createService(repository: OtpVerifyRepository) {
  return new OtpVerifyService({
    now: () => fixedNow,
    repository,
    withTransaction: (operation) => operation(repository),
  });
}

describe('OtpVerifyService', () => {
  it('verifies the latest active OTP and returns safe response metadata', async () => {
    const record = createRecord();
    const repository = new FakeOtpRepository([record]);
    const service = createService(repository);

    const result = await service.verifyOtp({
      code: '123456',
      email: 'person@example.com',
    });

    expect(result).toEqual({
      email: 'person@example.com',
      verifiedAt: '2026-05-24T12:00:00.000Z',
    });
    expect(JSON.stringify(result)).not.toContain('123456');
    expect(record.status).toBe('VERIFIED');
    expect(record.verifiedAt).toEqual(fixedNow);
  });

  it('rejects verification when no OTP exists for the email', async () => {
    const repository = new FakeOtpRepository();
    const service = createService(repository);

    await expect(
      service.verifyOtp({
        code: '123456',
        email: 'person@example.com',
      }),
    ).rejects.toBeInstanceOf(OtpVerifyMissingError);
  });

  it('rejects an older superseded OTP code when a newer code exists', async () => {
    const repository = new FakeOtpRepository([
      createRecord({
        code: '111111',
        createdAt: new Date('2026-05-24T11:57:00.000Z'),
        id: 'older',
        status: 'SUPERSEDED',
        supersededAt: new Date('2026-05-24T11:58:00.000Z'),
        supersededById: 'latest',
      }),
      createRecord({
        code: '222222',
        createdAt: new Date('2026-05-24T11:58:00.000Z'),
        id: 'latest',
      }),
    ]);
    const service = createService(repository);

    await expect(
      service.verifyOtp({
        code: '111111',
        email: 'person@example.com',
      }),
    ).rejects.toBeInstanceOf(OtpVerifySupersededError);
  });

  it('rejects expired OTPs', async () => {
    const repository = new FakeOtpRepository([
      createRecord({
        expiresAt: new Date('2026-05-24T12:00:00.000Z'),
      }),
    ]);
    const service = createService(repository);

    await expect(
      service.verifyOtp({
        code: '123456',
        email: 'person@example.com',
      }),
    ).rejects.toBeInstanceOf(OtpVerifyExpiredError);
  });

  it('rejects already verified OTPs', async () => {
    const repository = new FakeOtpRepository([
      createRecord({
        status: 'VERIFIED',
        verifiedAt: new Date('2026-05-24T11:59:00.000Z'),
      }),
    ]);
    const service = createService(repository);

    await expect(
      service.verifyOtp({
        code: '123456',
        email: 'person@example.com',
      }),
    ).rejects.toBeInstanceOf(OtpVerifyReusedError);
  });

  it('rejects incorrect OTP codes', async () => {
    const repository = new FakeOtpRepository([createRecord()]);
    const service = createService(repository);

    await expect(
      service.verifyOtp({
        code: '000000',
        email: 'person@example.com',
      }),
    ).rejects.toBeInstanceOf(OtpVerifyIncorrectError);
  });

  it('rejects when the conditional single-use update does not persist', async () => {
    const repository = new FakeOtpRepository([createRecord()]);
    repository.failConditionalVerification = true;
    const service = createService(repository);

    await expect(
      service.verifyOtp({
        code: '123456',
        email: 'person@example.com',
      }),
    ).rejects.toBeInstanceOf(OtpVerifyReusedError);
  });
});

import type { OtpRecord } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  DemoOtpDeliveryAdapter,
  DemoOtpDeliveryStore,
  type OtpDeliveryAdapter,
  type OtpDeliveryRequest,
  type OtpDeliveryResult,
} from '../delivery/otp-delivery.adapter.js';
import type { CreateOtpRecordInput, SupersedeActiveInput } from '../repositories/otp.repository.js';
import {
  OtpResendLimitError,
  OtpResendMissingError,
  OtpResendService,
  OtpResendWindowExpiredError,
  type OtpResendRepository,
} from './otp-resend.service.js';

class FakeOtpRepository implements OtpResendRepository {
  readonly records: OtpRecord[] = [];
  private nextId = 1;

  constructor(seedRecords: OtpRecord[] = []) {
    this.records.push(...seedRecords);
    this.nextId = seedRecords.length + 1;
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

  async countResendsForRequestGroup(requestGroupId: string): Promise<number> {
    return this.records.filter(
      (record) => record.requestGroupId === requestGroupId && record.issueReason === 'RESEND',
    ).length;
  }

  async create(data: CreateOtpRecordInput): Promise<OtpRecord> {
    const createdAt = fixedNow;
    const record: OtpRecord = {
      code: data.code,
      createdAt,
      email: data.email,
      expiresAt: data.expiresAt,
      id: `00000000-0000-0000-0000-${String(this.nextId).padStart(12, '0')}`,
      issueReason: data.issueReason ?? 'REQUEST',
      requestGroupId:
        data.requestGroupId ?? `10000000-0000-0000-0000-${String(this.nextId).padStart(12, '0')}`,
      resendCount: data.resendCount ?? 0,
      status: data.status ?? 'ACTIVE',
      supersededAt: null,
      supersededById: null,
      updatedAt: createdAt,
      verifiedAt: null,
    };

    this.nextId += 1;
    this.records.push(record);

    return record;
  }

  async supersedeActiveForEmail(input: SupersedeActiveInput): Promise<{ count: number }> {
    let count = 0;

    for (const record of this.records) {
      if (
        record.email === input.email &&
        record.status === 'ACTIVE' &&
        record.id !== input.supersededById
      ) {
        record.status = 'SUPERSEDED';
        record.supersededAt = input.supersededAt;
        record.supersededById = input.supersededById;
        count += 1;
      }
    }

    return { count };
  }
}

class CapturingDeliveryAdapter implements OtpDeliveryAdapter {
  readonly deliveries: OtpDeliveryRequest[] = [];

  async deliver(request: OtpDeliveryRequest): Promise<OtpDeliveryResult> {
    this.deliveries.push(request);

    return {
      mode: 'demo',
      status: 'captured',
    };
  }
}

const fixedNow = new Date('2026-05-24T12:00:00.000Z');
const requestGroupId = '10000000-0000-0000-0000-000000000111';

function createRecord(overrides: Partial<OtpRecord> = {}): OtpRecord {
  const createdAt = overrides.createdAt ?? new Date('2026-05-24T11:58:00.000Z');

  return {
    code: overrides.code ?? '111111',
    createdAt,
    email: overrides.email ?? 'person@example.com',
    expiresAt: overrides.expiresAt ?? new Date('2026-05-24T12:03:00.000Z'),
    id: overrides.id ?? '00000000-0000-0000-0000-000000000999',
    issueReason: overrides.issueReason ?? 'REQUEST',
    requestGroupId: overrides.requestGroupId ?? requestGroupId,
    resendCount: overrides.resendCount ?? 0,
    status: overrides.status ?? 'ACTIVE',
    supersededAt: overrides.supersededAt ?? null,
    supersededById: overrides.supersededById ?? null,
    updatedAt: overrides.updatedAt ?? createdAt,
    verifiedAt: overrides.verifiedAt ?? null,
  };
}

function createService(repository: OtpResendRepository, delivery: OtpDeliveryAdapter) {
  return new OtpResendService({
    config: {
      codeLength: 6,
      expirySeconds: 300,
      maxResends: 2,
      resendWindowMinutes: 5,
    },
    delivery,
    generateCode: () => '654321',
    now: () => fixedNow,
    repository,
    withTransaction: (operation) => operation(repository),
  });
}

describe('OtpResendService', () => {
  it('creates and delivers a resent OTP with safe response metadata', async () => {
    const repository = new FakeOtpRepository([createRecord()]);
    const delivery = new CapturingDeliveryAdapter();
    const service = createService(repository, delivery);

    const result = await service.resendOtp({ email: 'person@example.com' });

    expect(result).toEqual({
      delivery: {
        mode: 'demo',
        status: 'captured',
      },
      email: 'person@example.com',
      expiresAt: '2026-05-24T12:05:00.000Z',
      expiresInSeconds: 300,
      resendCount: 1,
    });
    expect(JSON.stringify(result)).not.toContain('654321');
    expect(delivery.deliveries).toHaveLength(1);
    expect(delivery.deliveries[0]).toMatchObject({
      code: '654321',
      email: 'person@example.com',
      issueReason: 'RESEND',
    });
  });

  it('rejects resend when no OTP exists for the email', async () => {
    const repository = new FakeOtpRepository();
    const delivery = new CapturingDeliveryAdapter();
    const service = createService(repository, delivery);

    await expect(service.resendOtp({ email: 'person@example.com' })).rejects.toBeInstanceOf(
      OtpResendMissingError,
    );
    expect(repository.records).toHaveLength(0);
    expect(delivery.deliveries).toHaveLength(0);
  });

  it('rejects resend after the configured resend window', async () => {
    const repository = new FakeOtpRepository([
      createRecord({ createdAt: new Date('2026-05-24T11:54:59.000Z') }),
    ]);
    const delivery = new CapturingDeliveryAdapter();
    const service = createService(repository, delivery);

    await expect(service.resendOtp({ email: 'person@example.com' })).rejects.toBeInstanceOf(
      OtpResendWindowExpiredError,
    );
    expect(repository.records).toHaveLength(1);
    expect(delivery.deliveries).toHaveLength(0);
  });

  it('rejects resend after the configured maximum resend count', async () => {
    const repository = new FakeOtpRepository([
      createRecord({
        createdAt: new Date('2026-05-24T11:57:00.000Z'),
        id: 'request',
        issueReason: 'REQUEST',
        status: 'SUPERSEDED',
      }),
      createRecord({
        code: '222222',
        createdAt: new Date('2026-05-24T11:58:00.000Z'),
        id: 'resend-1',
        issueReason: 'RESEND',
        resendCount: 1,
        status: 'SUPERSEDED',
      }),
      createRecord({
        code: '333333',
        createdAt: new Date('2026-05-24T11:59:00.000Z'),
        id: 'resend-2',
        issueReason: 'RESEND',
        resendCount: 2,
      }),
    ]);
    const delivery = new CapturingDeliveryAdapter();
    const service = createService(repository, delivery);

    await expect(service.resendOtp({ email: 'person@example.com' })).rejects.toBeInstanceOf(
      OtpResendLimitError,
    );
    expect(repository.records).toHaveLength(3);
    expect(delivery.deliveries).toHaveLength(0);
  });

  it('persists a resent OTP in the existing request group and supersedes previous active records', async () => {
    const previousRecord = createRecord({
      code: '111111',
      id: 'previous',
      status: 'ACTIVE',
    });
    const repository = new FakeOtpRepository([previousRecord]);
    const service = createService(repository, new CapturingDeliveryAdapter());

    await service.resendOtp({ email: 'person@example.com' });

    const newRecord = repository.records.find((record) => record.code === '654321');

    expect(newRecord).toMatchObject({
      issueReason: 'RESEND',
      requestGroupId,
      resendCount: 1,
      status: 'ACTIVE',
    });
    expect(previousRecord.status).toBe('SUPERSEDED');
    expect(previousRecord.supersededAt).toEqual(fixedNow);
    expect(previousRecord.supersededById).toBe(newRecord?.id);
  });

  it('captures demo deliveries for resent OTPs in the demo inbox store', async () => {
    const repository = new FakeOtpRepository([createRecord()]);
    const store = new DemoOtpDeliveryStore();
    const service = createService(repository, new DemoOtpDeliveryAdapter(store));

    await service.resendOtp({ email: 'person@example.com' });

    expect(store.list()).toEqual([
      expect.objectContaining({
        code: '654321',
        email: 'person@example.com',
        issueReason: 'RESEND',
      }),
    ]);
  });
});

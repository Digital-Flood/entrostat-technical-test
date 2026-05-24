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
import { OtpRequestService, type OtpRequestRepository } from './otp-request.service.js';
import { OtpRequestRateLimitError } from './otp-request.errors.js';

class FakeOtpRepository implements OtpRequestRepository {
  readonly records: OtpRecord[] = [];
  private nextId = 1;

  constructor(seedRecords: OtpRecord[] = []) {
    this.records.push(...seedRecords);
    this.nextId = seedRecords.length + 1;
  }

  async countRequestsCreatedSince(email: string, since: Date): Promise<number> {
    return this.records.filter(
      (record) =>
        record.email === email && record.issueReason === 'REQUEST' && record.createdAt >= since,
    ).length;
  }

  async create(data: CreateOtpRecordInput): Promise<OtpRecord> {
    const createdAt = new Date('2026-05-24T10:00:00.000Z');
    const record: OtpRecord = {
      code: data.code,
      createdAt,
      email: data.email,
      expiresAt: data.expiresAt,
      id: `00000000-0000-0000-0000-${String(this.nextId).padStart(12, '0')}`,
      issueReason: data.issueReason ?? 'REQUEST',
      requestGroupId: `10000000-0000-0000-0000-${String(this.nextId).padStart(12, '0')}`,
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

function createRecord(overrides: Partial<OtpRecord>): OtpRecord {
  const createdAt = overrides.createdAt ?? new Date('2026-05-24T11:00:00.000Z');

  return {
    code: overrides.code ?? '111111',
    createdAt,
    email: overrides.email ?? 'person@example.com',
    expiresAt: overrides.expiresAt ?? new Date('2026-05-24T11:05:00.000Z'),
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

function createService(repository: OtpRequestRepository, delivery: OtpDeliveryAdapter) {
  return new OtpRequestService({
    config: {
      codeLength: 6,
      expirySeconds: 300,
      maxRequestsPerHour: 2,
    },
    delivery,
    generateCode: () => '654321',
    now: () => fixedNow,
    repository,
    withTransaction: (operation) => operation(repository),
  });
}

describe('OtpRequestService', () => {
  it('creates and delivers an OTP request with safe response metadata', async () => {
    const repository = new FakeOtpRepository();
    const delivery = new CapturingDeliveryAdapter();
    const service = createService(repository, delivery);

    const result = await service.requestOtp({ email: 'person@example.com' });

    expect(result).toEqual({
      delivery: {
        mode: 'demo',
        status: 'captured',
      },
      email: 'person@example.com',
      expiresAt: '2026-05-24T12:05:00.000Z',
      expiresInSeconds: 300,
    });
    expect(JSON.stringify(result)).not.toContain('654321');
    expect(delivery.deliveries).toHaveLength(1);
    expect(delivery.deliveries[0]).toMatchObject({
      code: '654321',
      email: 'person@example.com',
      issueReason: 'REQUEST',
    });
  });

  it('rejects requests over the configured hourly request limit', async () => {
    const repository = new FakeOtpRepository([
      createRecord({ createdAt: new Date('2026-05-24T11:10:00.000Z'), id: 'request-1' }),
      createRecord({ createdAt: new Date('2026-05-24T11:20:00.000Z'), id: 'request-2' }),
    ]);
    const delivery = new CapturingDeliveryAdapter();
    const service = createService(repository, delivery);

    await expect(service.requestOtp({ email: 'person@example.com' })).rejects.toBeInstanceOf(
      OtpRequestRateLimitError,
    );
    expect(repository.records).toHaveLength(2);
    expect(delivery.deliveries).toHaveLength(0);
  });

  it('supersedes previous active OTP records for the same email', async () => {
    const previousRecord = createRecord({
      code: '111111',
      id: 'previous',
      status: 'ACTIVE',
    });
    const repository = new FakeOtpRepository([previousRecord]);
    const service = createService(repository, new CapturingDeliveryAdapter());

    await service.requestOtp({ email: 'person@example.com' });

    const newRecord = repository.records.find((record) => record.code === '654321');

    expect(previousRecord.status).toBe('SUPERSEDED');
    expect(previousRecord.supersededAt).toEqual(fixedNow);
    expect(previousRecord.supersededById).toBe(newRecord?.id);
    expect(newRecord?.status).toBe('ACTIVE');
  });

  it('captures demo deliveries in the demo inbox store', async () => {
    const repository = new FakeOtpRepository();
    const store = new DemoOtpDeliveryStore();
    const service = createService(repository, new DemoOtpDeliveryAdapter(store));

    await service.requestOtp({ email: 'person@example.com' });

    expect(store.list()).toEqual([
      expect.objectContaining({
        code: '654321',
        email: 'person@example.com',
        issueReason: 'REQUEST',
      }),
    ]);
  });
});

import type { OtpRecord } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import type { OtpConfig, OtpRuleSettings } from '../src/config/otp.config.js';
import {
  DemoOtpDeliveryAdapter,
  DemoOtpDeliveryStore,
  type OtpDeliveryAdapter,
  type OtpDeliveryRequest,
  type OtpDeliveryResult,
} from '../src/delivery/otp-delivery.adapter.js';
import type {
  CreateOtpRecordInput,
  EmailAndCodeLookup,
  EmailAndCodeSinceLookup,
  MarkVerifiedInput,
  SupersedeActiveInput,
} from '../src/repositories/otp.repository.js';
import {
  OtpRequestService,
  type OtpRequestRepository,
} from '../src/services/otp-request.service.js';
import { OtpResendService, type OtpResendRepository } from '../src/services/otp-resend.service.js';
import { OtpVerifyService, type OtpVerifyRepository } from '../src/services/otp-verify.service.js';

type OtpCrossFlowRepository = OtpRequestRepository & OtpResendRepository & OtpVerifyRepository;

const baseConfig = {
  codeLength: 6,
  expirySeconds: 30,
  maxRequestsPerHour: 3,
  maxResends: 3,
  resendWindowMinutes: 5,
} satisfies Pick<OtpConfig, 'codeLength'> & OtpRuleSettings;

class MutableClock {
  private current: Date;

  constructor(initialTime = '2026-05-24T12:00:00.000Z') {
    this.current = new Date(initialTime);
  }

  now = (): Date => new Date(this.current);

  set(time: string): void {
    this.current = new Date(time);
  }
}

class InMemoryOtpRepository implements OtpCrossFlowRepository {
  readonly records: OtpRecord[] = [];
  failNextOperation: string | undefined;
  private nextGroupId = 1;
  private nextId = 1;

  constructor(private readonly now: () => Date) {}

  async countRequestsCreatedSince(email: string, since: Date): Promise<number> {
    this.failIfRequested('countRequestsCreatedSince');

    return this.records.filter(
      (record) =>
        record.email === email && record.issueReason === 'REQUEST' && record.createdAt >= since,
    ).length;
  }

  async countResendsForRequestGroup(requestGroupId: string): Promise<number> {
    this.failIfRequested('countResendsForRequestGroup');

    return this.records.filter(
      (record) => record.requestGroupId === requestGroupId && record.issueReason === 'RESEND',
    ).length;
  }

  async create(data: CreateOtpRecordInput): Promise<OtpRecord> {
    this.failIfRequested('create');

    const createdAt = this.now();
    const record: OtpRecord = {
      code: data.code,
      createdAt,
      email: data.email,
      expiresAt: data.expiresAt,
      id: `00000000-0000-0000-0000-${String(this.nextId).padStart(12, '0')}`,
      issueReason: data.issueReason ?? 'REQUEST',
      requestGroupId: data.requestGroupId ?? this.createRequestGroupId(),
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

  async findByEmailAndCode({ email, code }: EmailAndCodeLookup): Promise<OtpRecord | null> {
    this.failIfRequested('findByEmailAndCode');

    return this.findLatestRecord((record) => record.email === email && record.code === code);
  }

  async findByEmailAndCodeCreatedSince({
    code,
    email,
    since,
  }: EmailAndCodeSinceLookup): Promise<OtpRecord | null> {
    this.failIfRequested('findByEmailAndCodeCreatedSince');

    return this.findLatestRecord(
      (record) => record.email === email && record.code === code && record.createdAt >= since,
    );
  }

  async findLatestByEmail(email: string): Promise<OtpRecord | null> {
    this.failIfRequested('findLatestByEmail');

    return this.findLatestRecord((record) => record.email === email);
  }

  async markVerifiedIfActive({ id, verifiedAt }: MarkVerifiedInput): Promise<{ count: number }> {
    this.failIfRequested('markVerifiedIfActive');

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

  async supersedeActiveForEmail(input: SupersedeActiveInput): Promise<{ count: number }> {
    this.failIfRequested('supersedeActiveForEmail');

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
        record.updatedAt = input.supersededAt;
        count += 1;
      }
    }

    return { count };
  }

  private createRequestGroupId(): string {
    const requestGroupId = `10000000-0000-0000-0000-${String(this.nextGroupId).padStart(12, '0')}`;

    this.nextGroupId += 1;

    return requestGroupId;
  }

  private failIfRequested(operation: string): void {
    if (this.failNextOperation !== operation) {
      return;
    }

    this.failNextOperation = undefined;
    throw new Error(`Database ${operation} failed.`);
  }

  private findLatestRecord(predicate: (record: OtpRecord) => boolean): OtpRecord | null {
    return (
      this.records.filter(predicate).sort((left, right) => {
        const createdAtDifference = right.createdAt.getTime() - left.createdAt.getTime();

        if (createdAtDifference !== 0) {
          return createdAtDifference;
        }

        return right.id.localeCompare(left.id);
      })[0] ?? null
    );
  }
}

class CapturingDeliveryAdapter implements OtpDeliveryAdapter {
  readonly deliveries: OtpDeliveryRequest[] = [];

  async deliver(deliveryRequest: OtpDeliveryRequest): Promise<OtpDeliveryResult> {
    this.deliveries.push(deliveryRequest);

    return {
      mode: 'demo',
      status: 'captured',
    };
  }
}

class FailingDeliveryAdapter implements OtpDeliveryAdapter {
  async deliver(): Promise<OtpDeliveryResult> {
    throw new Error('Production OTP delivery requires RESEND_API_KEY and OTP_EMAIL_FROM.');
  }
}

function createCodeGenerator(codes: string[]): (length: number) => string {
  return () => {
    const code = codes.shift();

    if (!code) {
      throw new Error('Test code sequence exhausted.');
    }

    return code;
  };
}

function createCrossFlowHarness(
  options: {
    codeSequence?: string[];
    config?: Partial<typeof baseConfig>;
    delivery?: OtpDeliveryAdapter;
  } = {},
) {
  const clock = new MutableClock();
  const repository = new InMemoryOtpRepository(clock.now);
  const delivery = options.delivery ?? new CapturingDeliveryAdapter();
  const config = {
    ...baseConfig,
    ...options.config,
  };
  const generateCode = createCodeGenerator(
    options.codeSequence ?? ['111111', '222222', '333333', '444444', '555555'],
  );

  const requestService = new OtpRequestService({
    config,
    delivery,
    generateCode,
    now: clock.now,
    repository,
    withTransaction: (operation) => operation(repository),
  });
  const resendService = new OtpResendService({
    config,
    delivery,
    generateCode,
    now: clock.now,
    repository,
    withTransaction: (operation) => operation(repository),
  });
  const verifyService = new OtpVerifyService({
    now: clock.now,
    repository,
    withTransaction: (operation) => operation(repository),
  });
  const app = createApp({
    otp: {
      requestService,
      resendService,
      verifyService,
    },
  });

  return {
    app,
    clock,
    delivery,
    repository,
  };
}

function expectInternalServerError(body: unknown): void {
  expect(body).toEqual({
    ok: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error.',
    },
  });
}

describe('OTP API cross-flow behaviour', () => {
  it('requests then verifies the latest OTP successfully', async () => {
    const { app, repository } = createCrossFlowHarness({ codeSequence: ['111111'] });

    const requestResponse = await request(app)
      .post('/otp/request')
      .send({ email: ' Person@Example.com ' });

    expect(requestResponse.status).toBe(201);
    expect(requestResponse.body).toMatchObject({
      ok: true,
      data: {
        email: 'person@example.com',
        expiresAt: '2026-05-24T12:00:30.000Z',
        expiresInSeconds: 30,
      },
    });
    expect(JSON.stringify(requestResponse.body)).not.toContain('111111');

    const verifyResponse = await request(app).post('/otp/verify').send({
      code: '111111',
      email: 'person@example.com',
    });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body).toEqual({
      ok: true,
      data: {
        email: 'person@example.com',
        verifiedAt: '2026-05-24T12:00:00.000Z',
      },
    });
    expect(repository.records[0]?.status).toBe('VERIFIED');
  });

  it('rejects the first requested code after a second request supersedes it', async () => {
    const { app, clock } = createCrossFlowHarness({ codeSequence: ['111111', '222222'] });

    await request(app).post('/otp/request').send({ email: 'person@example.com' });
    clock.set('2026-05-24T12:01:00.000Z');
    await request(app).post('/otp/request').send({ email: 'person@example.com' });

    const oldCodeResponse = await request(app).post('/otp/verify').send({
      code: '111111',
      email: 'person@example.com',
    });

    expect(oldCodeResponse.status).toBe(409);
    expect(oldCodeResponse.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_SUPERSEDED',
        message: 'OTP has been superseded.',
      },
    });

    const latestCodeResponse = await request(app).post('/otp/verify').send({
      code: '222222',
      email: 'person@example.com',
    });

    expect(latestCodeResponse.status).toBe(200);
  });

  it('resends the original code with updated expiry metadata', async () => {
    const { app, clock, delivery } = createCrossFlowHarness({
      codeSequence: ['111111'],
    });

    await request(app).post('/otp/request').send({ email: 'person@example.com' });
    clock.set('2026-05-24T12:01:00.000Z');

    const resendResponse = await request(app).post('/otp/resend').send({
      email: 'person@example.com',
    });

    expect(resendResponse.status).toBe(200);
    expect(resendResponse.body).toMatchObject({
      ok: true,
      data: {
        email: 'person@example.com',
        expiresAt: '2026-05-24T12:01:30.000Z',
        expiresInSeconds: 30,
        resendCount: 1,
      },
    });

    const resentOriginalCodeResponse = await request(app).post('/otp/verify').send({
      code: '111111',
      email: 'person@example.com',
    });

    expect(resentOriginalCodeResponse.status).toBe(200);
    expect((delivery as CapturingDeliveryAdapter).deliveries).toMatchObject([
      {
        code: '111111',
        issueReason: 'REQUEST',
      },
      {
        code: '111111',
        issueReason: 'RESEND',
      },
    ]);
  });

  it('rejects verified OTP codes when they are reused', async () => {
    const { app } = createCrossFlowHarness({ codeSequence: ['111111'] });

    await request(app).post('/otp/request').send({ email: 'person@example.com' });

    const firstResponse = await request(app).post('/otp/verify').send({
      code: '111111',
      email: 'person@example.com',
    });
    const reuseResponse = await request(app).post('/otp/verify').send({
      code: '111111',
      email: 'person@example.com',
    });

    expect(firstResponse.status).toBe(200);
    expect(reuseResponse.status).toBe(409);
    expect(reuseResponse.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_REUSED',
        message: 'OTP has already been verified.',
      },
    });
  });

  it('rejects resend after the latest OTP has already been verified', async () => {
    const { app, delivery } = createCrossFlowHarness({ codeSequence: ['111111'] });

    await request(app).post('/otp/request').send({ email: 'person@example.com' });
    const verifyResponse = await request(app).post('/otp/verify').send({
      code: '111111',
      email: 'person@example.com',
    });
    const resendResponse = await request(app).post('/otp/resend').send({
      email: 'person@example.com',
    });

    expect(verifyResponse.status).toBe(200);
    expect(resendResponse.status).toBe(409);
    expect(resendResponse.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_REUSED',
        message: 'OTP has already been verified.',
      },
    });
    expect((delivery as CapturingDeliveryAdapter).deliveries).toHaveLength(1);
  });

  it('rejects the latest OTP at the expiry boundary', async () => {
    const { app, clock } = createCrossFlowHarness({
      codeSequence: ['111111'],
      config: {
        expirySeconds: 60,
      },
    });

    await request(app).post('/otp/request').send({ email: 'person@example.com' });
    clock.set('2026-05-24T12:01:00.000Z');

    const response = await request(app).post('/otp/verify').send({
      code: '111111',
      email: 'person@example.com',
    });

    expect(response.status).toBe(410);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_EXPIRED',
        details: {
          expiresAt: '2026-05-24T12:01:00.000Z',
        },
        message: 'OTP has expired.',
      },
    });
  });

  it('rejects incorrect codes without changing OTP state', async () => {
    const { app, repository } = createCrossFlowHarness({ codeSequence: ['111111'] });

    await request(app).post('/otp/request').send({ email: 'person@example.com' });

    const incorrectResponse = await request(app).post('/otp/verify').send({
      code: '999999',
      email: 'person@example.com',
    });

    expect(incorrectResponse.status).toBe(401);
    expect(incorrectResponse.body.error.code).toBe('OTP_INCORRECT');
    expect(repository.records[0]).toMatchObject({
      status: 'ACTIVE',
      verifiedAt: null,
    });

    const correctResponse = await request(app).post('/otp/verify').send({
      code: '111111',
      email: 'person@example.com',
    });

    expect(correctResponse.status).toBe(200);
  });

  it('enforces the hourly request limit across multiple request attempts', async () => {
    const { app, clock, delivery } = createCrossFlowHarness({
      codeSequence: ['111111', '222222', '333333'],
      config: {
        maxRequestsPerHour: 2,
      },
    });

    const firstResponse = await request(app).post('/otp/request').send({
      email: 'person@example.com',
    });
    clock.set('2026-05-24T12:01:00.000Z');
    const secondResponse = await request(app).post('/otp/request').send({
      email: 'person@example.com',
    });
    clock.set('2026-05-24T12:02:00.000Z');
    const limitedResponse = await request(app).post('/otp/request').send({
      email: 'person@example.com',
    });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_RATE_LIMITED',
        details: {
          maxRequestsPerHour: 2,
        },
        message: 'OTP request limit exceeded.',
      },
    });
    expect((delivery as CapturingDeliveryAdapter).deliveries).toHaveLength(2);
  });

  it('enforces the resend count limit across one request group', async () => {
    const { app, clock, delivery } = createCrossFlowHarness({
      codeSequence: ['111111', '222222', '333333', '444444'],
      config: {
        maxResends: 2,
      },
    });

    await request(app).post('/otp/request').send({ email: 'person@example.com' });
    clock.set('2026-05-24T12:01:00.000Z');
    const firstResendResponse = await request(app).post('/otp/resend').send({
      email: 'person@example.com',
    });
    clock.set('2026-05-24T12:02:00.000Z');
    const secondResendResponse = await request(app).post('/otp/resend').send({
      email: 'person@example.com',
    });
    clock.set('2026-05-24T12:03:00.000Z');
    const limitedResponse = await request(app).post('/otp/resend').send({
      email: 'person@example.com',
    });

    expect(firstResendResponse.status).toBe(200);
    expect(secondResendResponse.status).toBe(200);
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body.error.code).toBe('OTP_RESEND_LIMITED');
    expect((delivery as CapturingDeliveryAdapter).deliveries).toHaveLength(3);
  });

  it('uses the latest OTP record time for the resend window and allows the exact boundary', async () => {
    const { app, clock } = createCrossFlowHarness({
      codeSequence: ['111111', '222222', '333333', '444444'],
      config: {
        maxResends: 3,
        resendWindowMinutes: 5,
      },
    });

    await request(app).post('/otp/request').send({ email: 'person@example.com' });
    clock.set('2026-05-24T12:04:00.000Z');
    await request(app).post('/otp/resend').send({ email: 'person@example.com' });
    clock.set('2026-05-24T12:09:00.000Z');

    const latestBoundaryResponse = await request(app).post('/otp/resend').send({
      email: 'person@example.com',
    });

    expect(latestBoundaryResponse.status).toBe(200);
    expect(latestBoundaryResponse.body.data.resendCount).toBe(2);

    clock.set('2026-05-24T12:14:01.000Z');

    const expiredWindowResponse = await request(app).post('/otp/resend').send({
      email: 'person@example.com',
    });

    expect(expiredWindowResponse.status).toBe(410);
    expect(expiredWindowResponse.body).toEqual({
      ok: false,
      error: {
        code: 'OTP_EXPIRED',
        details: {
          resendAvailableUntil: '2026-05-24T12:14:00.000Z',
          resendWindowMinutes: 5,
        },
        message: 'OTP resend window has expired.',
      },
    });
  });

  it('captures demo deliveries across request and resend without returning OTP codes', async () => {
    const store = new DemoOtpDeliveryStore();
    const { app, clock } = createCrossFlowHarness({
      codeSequence: ['111111'],
      delivery: new DemoOtpDeliveryAdapter(store),
    });

    const requestResponse = await request(app).post('/otp/request').send({
      email: 'person@example.com',
    });
    clock.set('2026-05-24T12:01:00.000Z');
    const resendResponse = await request(app).post('/otp/resend').send({
      email: 'person@example.com',
    });

    expect(JSON.stringify(requestResponse.body)).not.toContain('111111');
    expect(JSON.stringify(resendResponse.body)).not.toContain('111111');
    expect(store.list()).toEqual([
      expect.objectContaining({
        code: '111111',
        email: 'person@example.com',
        issueReason: 'RESEND',
      }),
      expect.objectContaining({
        code: '111111',
        email: 'person@example.com',
        issueReason: 'REQUEST',
      }),
    ]);
  });

  it('maps production delivery failures to the shared internal server error envelope', async () => {
    const { app } = createCrossFlowHarness({
      codeSequence: ['111111'],
      delivery: new FailingDeliveryAdapter(),
    });

    const response = await request(app).post('/otp/request').send({
      email: 'person@example.com',
    });

    expect(response.status).toBe(500);
    expectInternalServerError(response.body);
  });

  it('maps repository failures to the shared internal server error envelope', async () => {
    const requestHarness = createCrossFlowHarness({ codeSequence: ['111111'] });
    requestHarness.repository.failNextOperation = 'countRequestsCreatedSince';

    const requestResponse = await request(requestHarness.app).post('/otp/request').send({
      email: 'person@example.com',
    });

    expect(requestResponse.status).toBe(500);
    expectInternalServerError(requestResponse.body);

    const resendHarness = createCrossFlowHarness({ codeSequence: ['111111', '222222'] });
    await request(resendHarness.app).post('/otp/request').send({ email: 'person@example.com' });
    resendHarness.repository.failNextOperation = 'findLatestByEmail';

    const resendResponse = await request(resendHarness.app).post('/otp/resend').send({
      email: 'person@example.com',
    });

    expect(resendResponse.status).toBe(500);
    expectInternalServerError(resendResponse.body);

    const verifyHarness = createCrossFlowHarness({ codeSequence: ['111111'] });
    await request(verifyHarness.app).post('/otp/request').send({ email: 'person@example.com' });
    verifyHarness.repository.failNextOperation = 'markVerifiedIfActive';

    const verifyResponse = await request(verifyHarness.app).post('/otp/verify').send({
      code: '111111',
      email: 'person@example.com',
    });

    expect(verifyResponse.status).toBe(500);
    expectInternalServerError(verifyResponse.body);
  });
});

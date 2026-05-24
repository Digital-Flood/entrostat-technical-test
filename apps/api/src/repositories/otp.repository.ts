import type { OtpIssueReason, OtpRecord, OtpStatus, PrismaClient } from '@prisma/client';

import { prisma } from '../prisma/client.js';

export type OtpPersistenceClient = Pick<PrismaClient, 'otpRecord'>;

export type CreateOtpRecordInput = {
  email: string;
  code: string;
  expiresAt: Date;
  issueReason?: OtpIssueReason;
  requestGroupId?: string;
  resendCount?: number;
  status?: OtpStatus;
};

export type EmailAndCodeLookup = {
  email: string;
  code: string;
};

export type SupersedeActiveInput = {
  email: string;
  supersededAt: Date;
  supersededById: string;
};

export type MarkVerifiedInput = {
  id: string;
  verifiedAt: Date;
};

export class OtpRepository {
  constructor(private readonly db: OtpPersistenceClient = prisma) {}

  create(data: CreateOtpRecordInput): Promise<OtpRecord> {
    return this.db.otpRecord.create({
      data,
    });
  }

  findById(id: string): Promise<OtpRecord | null> {
    return this.db.otpRecord.findUnique({
      where: {
        id,
      },
    });
  }

  findLatestByEmail(email: string): Promise<OtpRecord | null> {
    return this.db.otpRecord.findFirst({
      where: {
        email,
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
    });
  }

  findLatestActiveByEmail(email: string): Promise<OtpRecord | null> {
    return this.db.otpRecord.findFirst({
      where: {
        email,
        status: 'ACTIVE',
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
    });
  }

  findByEmailAndCode({ email, code }: EmailAndCodeLookup): Promise<OtpRecord | null> {
    return this.db.otpRecord.findFirst({
      where: {
        email,
        code,
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
    });
  }

  countCreatedSince(email: string, since: Date): Promise<number> {
    return this.db.otpRecord.count({
      where: {
        email,
        createdAt: {
          gte: since,
        },
      },
    });
  }

  countResendsForRequestGroup(requestGroupId: string): Promise<number> {
    return this.db.otpRecord.count({
      where: {
        requestGroupId,
        issueReason: 'RESEND',
      },
    });
  }

  supersedeActiveForEmail({ email, supersededAt, supersededById }: SupersedeActiveInput) {
    return this.db.otpRecord.updateMany({
      where: {
        email,
        status: 'ACTIVE',
        id: {
          not: supersededById,
        },
      },
      data: {
        status: 'SUPERSEDED',
        supersededAt,
        supersededById,
      },
    });
  }

  markVerifiedIfActive({ id, verifiedAt }: MarkVerifiedInput) {
    return this.db.otpRecord.updateMany({
      where: {
        id,
        status: 'ACTIVE',
        verifiedAt: null,
      },
      data: {
        status: 'VERIFIED',
        verifiedAt,
      },
    });
  }
}

export const otpRepository = new OtpRepository();

export function withOtpRepositoryTransaction<T>(
  operation: (repository: OtpRepository) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((transaction) => operation(new OtpRepository(transaction)));
}

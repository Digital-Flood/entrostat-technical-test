import { describe, expect, it } from 'vitest';

import { createPrismaClientOptions, getDatabaseUrl } from './create-client.js';

describe('Prisma client configuration', () => {
  it('requires DATABASE_URL before constructing Prisma options', () => {
    expect(() => getDatabaseUrl({})).toThrow('DATABASE_URL is required to initialise Prisma.');
    expect(() => getDatabaseUrl({ DATABASE_URL: '   ' })).toThrow(
      'DATABASE_URL is required to initialise Prisma.',
    );
  });

  it('constructs Prisma options with the Postgres adapter', () => {
    const options = createPrismaClientOptions({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/entrostat_otp',
    });

    expect(options).toMatchObject({
      adapter: expect.objectContaining({
        adapterName: '@prisma/adapter-pg',
        provider: 'postgres',
      }),
    });
  });
});

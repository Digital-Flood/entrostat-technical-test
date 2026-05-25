import process from 'node:process';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

type PrismaEnvironment = {
  DATABASE_URL?: string;
};

export function getDatabaseUrl(env: PrismaEnvironment = process.env): string {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to initialise Prisma.');
  }

  return databaseUrl;
}

export function createPrismaClientOptions(
  env: PrismaEnvironment = process.env,
): ConstructorParameters<typeof PrismaClient>[0] {
  const adapter = new PrismaPg({ connectionString: getDatabaseUrl(env) });

  return { adapter };
}

export function createPrismaClient(env: PrismaEnvironment = process.env): PrismaClient {
  return new PrismaClient(createPrismaClientOptions(env));
}

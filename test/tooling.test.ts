import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

type RootPackage = {
  workspaces?: string[];
};

describe('root workspace tooling', () => {
  it('keeps the planned npm workspace roots configured', async () => {
    const rootPackage = JSON.parse(await readFile('package.json', 'utf8')) as RootPackage;

    expect(rootPackage.workspaces).toEqual(['apps/*', 'packages/*']);
  });
});

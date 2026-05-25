import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const configDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(configDirectory, '../..');
const rootEnvPath = resolve(repositoryRoot, '.env');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot, '');
  const port = Number(readRootEnvValue('WEB_PORT') ?? env.WEB_PORT ?? 5173);

  return {
    envDir: repositoryRoot,
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port,
    },
    preview: {
      host: '0.0.0.0',
      port,
    },
  };
});

function readRootEnvValue(key: string): string | undefined {
  if (!existsSync(rootEnvPath)) {
    return undefined;
  }

  const line = readFileSync(rootEnvPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));

  return line?.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
}

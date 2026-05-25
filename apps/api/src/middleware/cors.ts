import type { RequestHandler } from 'express';

function getAllowedOrigins(): Set<string> {
  const webPort = process.env.WEB_PORT ?? '5173';
  const configuredOrigins = (process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return new Set([
    `http://localhost:${webPort}`,
    `http://127.0.0.1:${webPort}`,
    ...configuredOrigins,
  ]);
}

export const corsMiddleware: RequestHandler = (request, response, next) => {
  const origin = request.headers.origin;

  if (origin && (getAllowedOrigins().has(origin) || isLocalhostOrigin(origin))) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }

  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  next();
};

function isLocalhostOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);

    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';

describe('API routes', () => {
  const app = createApp();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the health check using the shared success envelope', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        status: 'ok',
      },
    });
  });

  it('returns the shared not found error envelope for unknown routes', async () => {
    const response = await request(app).get('/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found.',
      },
    });
  });

  it('returns the shared malformed JSON error envelope for invalid JSON bodies', async () => {
    const response = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{"broken"');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'MALFORMED_JSON',
        message: 'Malformed JSON body.',
      },
    });
  });

  it('allows local web preflight requests', async () => {
    const response = await request(app)
      .options('/otp/request')
      .set('Origin', 'http://localhost:5175')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5175');
    expect(response.headers['access-control-allow-methods']).toBe('GET,POST,PUT,OPTIONS');
  });

  it('logs unexpected errors while returning the generic internal error envelope', async () => {
    const unexpectedError = new Error('database unavailable');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const appWithFailingService = createApp({
      otp: {
        requestService: {
          requestOtp: vi.fn().mockRejectedValue(unexpectedError),
        },
      },
    });

    const response = await request(appWithFailingService).post('/otp/request').send({
      email: 'person@example.com',
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error.',
      },
    });
    expect(consoleError).toHaveBeenCalledWith('Unexpected API error', {
      error: expect.objectContaining({
        message: 'database unavailable',
        name: 'Error',
      }),
      method: 'POST',
      path: '/otp/request',
    });
  });

  it('redacts DATABASE_URL from unexpected error logs', async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const databaseUrl = 'postgresql://user:secret@localhost:5432/entrostat_otp?schema=public';
    process.env.DATABASE_URL = databaseUrl;

    try {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const appWithFailingService = createApp({
        otp: {
          requestService: {
            requestOtp: vi
              .fn()
              .mockRejectedValue(new Error(`connection failed for ${databaseUrl}`)),
          },
        },
      });

      await request(appWithFailingService).post('/otp/request').send({
        email: 'person@example.com',
      });

      const loggedPayload = JSON.stringify(consoleError.mock.calls);

      expect(loggedPayload).toContain('[DATABASE_URL redacted]');
      expect(loggedPayload).not.toContain(databaseUrl);
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });
});

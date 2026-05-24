import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('API routes', () => {
  const app = createApp();

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
    expect(response.headers['access-control-allow-methods']).toBe('GET,POST,OPTIONS');
  });
});

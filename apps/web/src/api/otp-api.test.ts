import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestOtp, requestWithApiWakeRetry } from './otp-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OTP API client', () => {
  it('classifies non-JSON Render gateway responses as API startup', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }));

    const result = await requestOtp({ email: 'person@example.com' });

    expect(result).toMatchObject({
      kind: 'api-starting',
      reason: 'gateway',
      status: 502,
    });
  });

  it('keeps structured internal errors distinct from startup responses', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
          },
        }),
        { status: 500 },
      ),
    );

    const result = await requestOtp({ email: 'person@example.com' });

    expect(result).toMatchObject({
      body: {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
        ok: false,
      },
      kind: 'api-error',
      status: 500,
    });
  });

  it('waits for health and retries a startup-affected action once', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { status: 'ok' } }), { status: 200 }),
    );
    const operation = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'api-starting',
        message: 'Render returned a non-JSON gateway response.',
        reason: 'gateway',
        status: 503,
      })
      .mockResolvedValueOnce({
        body: {
          data: {
            delivery: {
              mode: 'production',
              status: 'queued',
            },
            email: 'person@example.com',
            expiresAt: '2026-05-25T10:00:00.000Z',
            expiresInSeconds: 30,
          },
          ok: true,
        },
        kind: 'success',
        status: 200,
      });

    const result = await requestWithApiWakeRetry(operation);

    expect(operation).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      body: {
        data: {
          email: 'person@example.com',
        },
      },
      kind: 'success',
      retriedAfterWake: true,
    });
  });
});

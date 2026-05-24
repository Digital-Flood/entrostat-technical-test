import { describe, expect, it } from 'vitest';

import { ApiErrorCode } from './api-error-code.js';
import { createErrorResponse, createSuccessResponse } from './api-response.js';

describe('API response helpers', () => {
  it('creates a success response envelope', () => {
    expect(createSuccessResponse({ status: 'ok' })).toEqual({
      ok: true,
      data: {
        status: 'ok',
      },
    });
  });

  it('creates an error response envelope without optional details', () => {
    expect(createErrorResponse(ApiErrorCode.NotFound, 'Not found.')).toEqual({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found.',
      },
    });
  });

  it('creates an error response envelope with details', () => {
    expect(
      createErrorResponse(ApiErrorCode.ValidationError, 'Validation failed.', [
        { field: 'identifier', message: 'Identifier is required.' },
      ]),
    ).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        details: [{ field: 'identifier', message: 'Identifier is required.' }],
      },
    });
  });
});

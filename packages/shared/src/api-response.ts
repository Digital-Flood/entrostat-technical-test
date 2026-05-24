import type { ApiErrorCodeValue } from './api-error-code.js';

export type ApiSuccessResponse<Data> = {
  ok: true;
  data: Data;
};

export type ApiErrorBody<Details = unknown> = {
  code: ApiErrorCodeValue;
  message: string;
  details?: Details;
};

export type ApiErrorResponse<Details = unknown> = {
  ok: false;
  error: ApiErrorBody<Details>;
};

export type ApiResponse<Data, Details = unknown> =
  | ApiSuccessResponse<Data>
  | ApiErrorResponse<Details>;

export function createSuccessResponse<Data>(data: Data): ApiSuccessResponse<Data> {
  return {
    ok: true,
    data,
  };
}

export function createErrorResponse(code: ApiErrorCodeValue, message: string): ApiErrorResponse;
export function createErrorResponse<Details>(
  code: ApiErrorCodeValue,
  message: string,
  details: Details,
): ApiErrorResponse<Details>;
export function createErrorResponse<Details>(
  code: ApiErrorCodeValue,
  message: string,
  details?: Details,
): ApiErrorResponse<Details> {
  if (arguments.length < 3) {
    return {
      ok: false,
      error: {
        code,
        message,
      },
    };
  }

  return {
    ok: false,
    error: {
      code,
      message,
      details: details as Details,
    },
  };
}

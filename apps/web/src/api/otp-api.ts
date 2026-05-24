import type { ApiErrorResponse, ApiResult, ValidationIssue } from '../types/api';
import type { DevOtpInboxData, OtpRequestData, OtpResendData, OtpVerifyData } from '../types/otp';

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

type OtpEmailPayload = {
  email: string;
};

type OtpVerifyPayload = OtpEmailPayload & {
  code: string;
};

type OtpErrorDetails = ValidationIssue[] | Record<string, unknown>;

export type OtpApiErrorResponse = ApiErrorResponse<OtpErrorDetails>;

function buildUrl(path: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
}

async function requestJson<Data>(
  path: string,
  init: RequestInit,
): Promise<ApiResult<Data, OtpErrorDetails>> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json()) as ApiResult<Data, OtpErrorDetails>['body'];

  return {
    body,
    status: response.status,
  };
}

export function requestOtp(payload: OtpEmailPayload) {
  return requestJson<OtpRequestData>('/otp/request', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function resendOtp(payload: OtpEmailPayload) {
  return requestJson<OtpResendData>('/otp/resend', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function verifyOtp(payload: OtpVerifyPayload) {
  return requestJson<OtpVerifyData>('/otp/verify', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function fetchDemoInbox() {
  return requestJson<DevOtpInboxData>('/dev/otp-inbox', {
    method: 'GET',
  });
}

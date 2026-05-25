import type {
  ApiErrorResponse,
  ApiMalformedResult,
  ApiNetworkErrorResult,
  ApiResult,
  ApiStartupResult,
  ApiSuccessResponse,
  ValidationIssue,
} from '../types/api';
import type {
  DevOtpInboxData,
  OtpRequestData,
  OtpResendData,
  OtpSettingsData,
  OtpVerifyData,
} from '../types/otp';

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

type OtpEmailPayload = {
  email: string;
};

type OtpVerifyPayload = OtpEmailPayload & {
  code: string;
};

type OtpSettingsPayload = Pick<
  OtpSettingsData,
  'expirySeconds' | 'maxRequestsPerHour' | 'maxResends' | 'resendWindowMinutes'
>;

type OtpErrorDetails = ValidationIssue[] | Record<string, unknown>;

export type OtpApiErrorResponse = ApiErrorResponse<OtpErrorDetails>;
type HealthData = {
  status: 'ok';
};
type ApiAvailabilityResult = ApiStartupResult | ApiNetworkErrorResult;
type ApiActionResult<Data> = ApiResult<Data, OtpErrorDetails> & {
  retriedAfterWake?: boolean;
  wakeTimedOut?: boolean;
};
type WaitForApiHealthResult =
  | {
      ok: true;
      result: Extract<ApiResult<HealthData>, { kind: 'success' }>;
    }
  | {
      ok: false;
      result: ApiAvailabilityResult | ApiMalformedResult;
    };

const renderStartupStatuses = new Set([502, 503, 504]);
const healthPollIntervalMs = 2_000;
const healthWakeTimeoutMs = 75_000;
const healthRequestTimeoutMs = 8_000;

function buildUrl(path: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
}

async function requestJson<Data>(
  path: string,
  init: RequestInit,
): Promise<ApiResult<Data, OtpErrorDetails>> {
  try {
    const response = await fetch(buildUrl(path), {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    const bodyText = await response.text();

    return parseApiResponse<Data>(response.status, bodyText);
  } catch {
    return createNetworkError();
  }
}

function parseApiResponse<Data>(
  status: number,
  bodyText: string,
): ApiResult<Data, OtpErrorDetails> {
  const isRenderStartupStatus = renderStartupStatuses.has(status);

  if (!bodyText.trim()) {
    return isRenderStartupStatus
      ? createApiStartupResult(status, 'Render returned an empty gateway response.')
      : createMalformedResponse(status);
  }

  let body: unknown;

  try {
    body = JSON.parse(bodyText);
  } catch {
    return isRenderStartupStatus
      ? createApiStartupResult(status, 'Render returned a non-JSON gateway response.')
      : createMalformedResponse(status);
  }

  if (isApiSuccessBody<Data>(body)) {
    return {
      body,
      kind: 'success',
      status,
    };
  }

  if (isApiErrorBody<OtpErrorDetails>(body)) {
    return {
      body,
      kind: 'api-error',
      status,
    };
  }

  return isRenderStartupStatus
    ? createApiStartupResult(status, 'Render returned a gateway response before the API was ready.')
    : createMalformedResponse(status);
}

function createApiStartupResult(status: number | null, message: string): ApiStartupResult {
  return {
    kind: 'api-starting',
    message,
    reason: 'gateway',
    status,
  };
}

function createHealthTimeoutResult(status: number | null): ApiStartupResult {
  return {
    kind: 'api-starting',
    message: 'The API did not become ready before the wake-up check timed out.',
    reason: 'health-timeout',
    status,
  };
}

function createNetworkError(): ApiNetworkErrorResult {
  return {
    kind: 'network-error',
    message: 'The API could not be reached.',
    status: null,
  };
}

function createMalformedResponse(status: number): ApiMalformedResult {
  return {
    kind: 'malformed-response',
    message: 'The API returned a response that the console could not read.',
    status,
  };
}

function isApiSuccessBody<Data>(body: unknown): body is ApiSuccessResponse<Data> {
  return isRecord(body) && body.ok === true && 'data' in body;
}

function isApiErrorBody<Details>(body: unknown): body is ApiErrorResponse<Details> {
  return (
    isRecord(body) &&
    body.ok === false &&
    isRecord(body.error) &&
    typeof body.error.code === 'string' &&
    typeof body.error.message === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createTimedSignal(timeoutMs: number): { clear: () => void; signal: AbortSignal } {
  const controller = new globalThis.AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  return {
    clear: () => globalThis.clearTimeout(timer),
    signal: controller.signal,
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });
}

export function isApiAvailabilityIssue(
  result: ApiResult<unknown, unknown>,
): result is ApiAvailabilityResult {
  return result.kind === 'api-starting' || result.kind === 'network-error';
}

export function checkApiHealth(signal?: AbortSignal) {
  return requestJson<HealthData>('/health', {
    method: 'GET',
    ...(signal ? { signal } : {}),
  });
}

export async function waitForApiHealth({
  intervalMs = healthPollIntervalMs,
  requestTimeoutMs = healthRequestTimeoutMs,
  timeoutMs = healthWakeTimeoutMs,
}: {
  intervalMs?: number;
  requestTimeoutMs?: number;
  timeoutMs?: number;
} = {}): Promise<WaitForApiHealthResult> {
  const deadline = Date.now() + timeoutMs;
  let lastResult: ApiResult<HealthData> | null = null;

  while (Date.now() < deadline) {
    const remainingMs = Math.max(deadline - Date.now(), 1);
    const timedSignal = createTimedSignal(Math.min(requestTimeoutMs, remainingMs));

    try {
      lastResult = await checkApiHealth(timedSignal.signal);
    } finally {
      timedSignal.clear();
    }

    if (lastResult.kind === 'success') {
      return {
        ok: true,
        result: lastResult,
      };
    }

    const waitMs = Math.min(intervalMs, Math.max(deadline - Date.now(), 0));

    if (waitMs <= 0) {
      break;
    }

    await delay(waitMs);
  }

  if (lastResult?.kind === 'malformed-response') {
    return {
      ok: false,
      result: lastResult,
    };
  }

  return {
    ok: false,
    result: createHealthTimeoutResult(lastResult?.status ?? null),
  };
}

export async function requestWithApiWakeRetry<Data>(
  operation: () => Promise<ApiResult<Data, OtpErrorDetails>>,
  {
    onApiReady,
    onWaitingForApi,
  }: {
    onApiReady?: () => void;
    onWaitingForApi?: (result: ApiAvailabilityResult) => void;
  } = {},
): Promise<ApiActionResult<Data>> {
  const firstResult = await operation();

  if (!isApiAvailabilityIssue(firstResult)) {
    return firstResult;
  }

  onWaitingForApi?.(firstResult);

  const healthResult = await waitForApiHealth();

  if (!healthResult.ok) {
    const failedResult = firstResult.kind === 'network-error' ? firstResult : healthResult.result;

    return {
      ...failedResult,
      wakeTimedOut: true,
    } as ApiActionResult<Data>;
  }

  onApiReady?.();

  return {
    ...(await operation()),
    retriedAfterWake: true,
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

export function fetchOtpSettings() {
  return requestJson<OtpSettingsData>('/settings/otp', {
    method: 'GET',
  });
}

export function updateOtpSettings(payload: OtpSettingsPayload) {
  return requestJson<OtpSettingsData>('/settings/otp', {
    body: JSON.stringify(payload),
    method: 'PUT',
  });
}

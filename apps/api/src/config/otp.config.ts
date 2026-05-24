export type OtpDeliveryMode = 'demo' | 'production';

export type OtpConfig = {
  codeLength: number;
  deliveryMode: OtpDeliveryMode;
  emailFrom: string | undefined;
  expirySeconds: number;
  maxRequestsPerHour: number;
  maxResends: number;
  resendWindowMinutes: number;
  resendApiKey: string | undefined;
};

const DEFAULT_CODE_LENGTH = 6;
const DEFAULT_EXPIRY_SECONDS = 300;
const DEFAULT_MAX_REQUESTS_PER_HOUR = 5;
const DEFAULT_MAX_RESENDS = 3;
const DEFAULT_RESEND_WINDOW_MINUTES = 5;
const DEFAULT_DELIVERY_MODE: OtpDeliveryMode = 'demo';

function readInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function readDeliveryMode(value: string | undefined): OtpDeliveryMode {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_DELIVERY_MODE;
  }

  if (value === 'demo' || value === 'production') {
    return value;
  }

  throw new Error('OTP_DELIVERY_MODE must be either demo or production.');
}

export function getOtpConfig(env: NodeJS.ProcessEnv = process.env): OtpConfig {
  return {
    codeLength: readInteger(env.OTP_LENGTH, DEFAULT_CODE_LENGTH, 'OTP_LENGTH'),
    deliveryMode: readDeliveryMode(env.OTP_DELIVERY_MODE),
    emailFrom: env.OTP_EMAIL_FROM,
    expirySeconds: readInteger(
      env.OTP_EXPIRY_SECONDS,
      DEFAULT_EXPIRY_SECONDS,
      'OTP_EXPIRY_SECONDS',
    ),
    maxRequestsPerHour: readInteger(
      env.OTP_MAX_REQUESTS_PER_HOUR,
      DEFAULT_MAX_REQUESTS_PER_HOUR,
      'OTP_MAX_REQUESTS_PER_HOUR',
    ),
    maxResends: readInteger(env.OTP_MAX_RESENDS, DEFAULT_MAX_RESENDS, 'OTP_MAX_RESENDS'),
    resendWindowMinutes: readInteger(
      env.OTP_RESEND_WINDOW_MINUTES,
      DEFAULT_RESEND_WINDOW_MINUTES,
      'OTP_RESEND_WINDOW_MINUTES',
    ),
    resendApiKey: env.RESEND_API_KEY,
  };
}

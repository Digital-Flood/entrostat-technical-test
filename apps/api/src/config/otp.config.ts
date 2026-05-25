export type OtpDeliveryMode = 'demo' | 'production';

export type OtpConfig = {
  codeLength: number;
  deliveryMode: OtpDeliveryMode;
  emailFrom: string | undefined;
  resendApiKey: string | undefined;
};

export type OtpRuleSettings = {
  expirySeconds: number;
  maxRequestsPerHour: number;
  maxResends: number;
  resendWindowMinutes: number;
};

export const DEFAULT_OTP_CODE_LENGTH = 6;
export const DEFAULT_OTP_RULE_SETTINGS: OtpRuleSettings = {
  expirySeconds: 30,
  maxRequestsPerHour: 3,
  maxResends: 3,
  resendWindowMinutes: 5,
};

const DEFAULT_DELIVERY_MODE: OtpDeliveryMode = 'demo';

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
    codeLength: DEFAULT_OTP_CODE_LENGTH,
    deliveryMode: readDeliveryMode(env.OTP_DELIVERY_MODE),
    emailFrom: env.OTP_EMAIL_FROM,
    resendApiKey: env.RESEND_API_KEY,
  };
}

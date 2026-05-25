import {
  DEFAULT_OTP_CODE_LENGTH,
  DEFAULT_OTP_RULE_SETTINGS,
  type OtpRuleSettings,
} from '../config/otp.config.js';

export type OtpSettingsResult = OtpRuleSettings & {
  codeLength: number;
};

export type OtpSettingsProvider = {
  getSettings(): OtpRuleSettings;
};

export type OtpSettingsService = OtpSettingsProvider & {
  getOtpSettings(): OtpSettingsResult;
  updateOtpSettings(settings: OtpRuleSettings): OtpSettingsResult;
};

export class InMemoryOtpSettingsService implements OtpSettingsService {
  private settings: OtpRuleSettings;

  constructor(initialSettings: OtpRuleSettings = DEFAULT_OTP_RULE_SETTINGS) {
    this.settings = { ...initialSettings };
  }

  getSettings(): OtpRuleSettings {
    return { ...this.settings };
  }

  getOtpSettings(): OtpSettingsResult {
    return this.toResult();
  }

  updateOtpSettings(settings: OtpRuleSettings): OtpSettingsResult {
    this.settings = { ...settings };

    return this.toResult();
  }

  private toResult(): OtpSettingsResult {
    return {
      ...this.settings,
      codeLength: DEFAULT_OTP_CODE_LENGTH,
    };
  }
}

export const otpSettingsService = new InMemoryOtpSettingsService();

export type OtpDeliveryMetadata = {
  mode: 'demo' | 'production';
  status: 'captured' | 'queued';
};

export type OtpRequestData = {
  delivery: OtpDeliveryMetadata;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
};

export type OtpResendData = OtpRequestData & {
  resendCount: number;
};

export type OtpVerifyData = {
  email: string;
  verifiedAt: string;
};

export type DevOtpInboxDelivery = {
  code: string;
  deliveredAt: string;
  email: string;
  expiresAt: string;
  issueReason: 'REQUEST' | 'RESEND';
  otpRecordId: string;
};

export type DevOtpInboxData = {
  deliveries: DevOtpInboxDelivery[];
  deliveryMode: 'demo';
};

import { OtpChannel, OtpPurpose, Role } from '@prisma/client';

export const AUTH_ENUMS = {
  USER: {
    ROLE: Role,
  },
  OTP: {
    PURPOSE: OtpPurpose,
    CHANNEL: OtpChannel,
  },
} as const;

export const OTP_PUBLIC_PURPOSES = [
  OtpPurpose.REGISTRATION,
  OtpPurpose.LOGIN,
  OtpPurpose.PIN_RESET,
] as const;

export const OTP_SEND_PURPOSES = [
  OtpPurpose.REGISTRATION,
  OtpPurpose.PIN_RESET,
] as const;

export type PublicOtpPurpose = (typeof OTP_PUBLIC_PURPOSES)[number];
export type OtpSendPurpose = (typeof OTP_SEND_PURPOSES)[number];

export { OtpChannel, OtpPurpose, Role as UserRole };

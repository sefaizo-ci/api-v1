import type { OtpChannel } from '../../core/enums/auth.enums';
import type { OnboardingMeta } from '../../core/services/user.service.interface';

export type InitAuthFlowResult = {
  nextStep: 'PIN_THEN_OTP' | 'OTP';
};

export type SendOtpResult = {
  channel: OtpChannel;
};

export type VerifyOtpResult = {
  challengeToken: string;
  scope: 'challenge-only';
  expiresIn: number;
};

export type StartLoginResult = {
  challengeToken: string;
  scope: 'challenge-only';
  channel: OtpChannel;
  expiresIn: number;
};

export type AuthTokensResult = {
  accessToken: string;
  refreshToken: string;
  professionalId: string | null;
  clientId: string | null;
  user: {
    id: string;
    phone: string;
    firstName: string;
    app: string;
    hasAcceptedTerms: boolean;
    acceptedTermsAt: string | null;
    onboarding: OnboardingMeta | null;
  };
};

export type RefreshTokenResult = {
  accessToken: string;
  refreshToken: string;
};

export type MessageResult = {
  message: string;
};

export type AcceptTermsResult = {
  acceptedTermsAt: string;
};

export type CompleteOnboardingResult = {
  onboardingCompletedAt: string;
};

export type SkipOnboardingStepResult = {
  skipped: string;
};

export type GetMeResult = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  isVerified: boolean;
};

export type SessionResult = {
  id: string;
  platform: string | null;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
};

export type UpdateUserProfileResult = {
  id: string;
  firstName: string;
  lastName: string;
  onboarding: OnboardingMeta;
};

export type { OnboardingMeta as GetOnboardingMetaResult };

export const APP = {
  ROOT: '/',
  HEALTH: 'health',
  API: {
    PREFIX: 'api/v1',
  },
  DOCS: {
    BASE: 'api-docs',
  },
} as const;

export const AUTH = {
  BASE: 'sentinel',
  FLOW: {
    INIT: 'flow/init',
  },
  OTP: {
    SEND: 'otp/send',
    VERIFY: 'otp/verify',
  },
  PIN: {
    CREATE: 'pin/create',
    RESET: 'pin/reset',
    CHANGE: 'pin/change',
  },
  LOGIN: {
    START: 'login/start',
    COMPLETE: 'login/complete',
  },
  TERMS: {
    ACCEPT: 'terms/accept',
  },
  TOKEN_REFRESH: 'token/refresh',
  LOGOUT: 'logout',
  ME: 'me',
  ME_UPDATE: 'me',
  ONBOARDING_COMPLETE: 'me/onboarding/complete',
  SESSIONS: 'me/sessions',
  PUSH_TOKEN: 'me/push-token',
  COOKIE: {
    REFRESH: {
      NAME: 'refreshToken',
      PATH: `/${APP.API.PREFIX}/sentinel`,
    },
  },
} as const;

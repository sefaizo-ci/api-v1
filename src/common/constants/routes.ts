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
  BASE: 'auth',
  FLOW: {
    INIT: 'flow/init',
  },
  OTP: {
    SEND: 'otp/send',
    VERIFY: 'otp/verify',
  },
  REGISTER: {
    COMPLETE: 'register/complete',
  },
  LOGIN: {
    START: 'login/start',
  },
  TOKEN_REFRESH: 'token/refresh',
  LOGOUT: 'logout',
  ME: 'me',
  COOKIE: {
    REFRESH: {
      NAME: 'refreshToken',
      PATH: `/${APP.API.PREFIX}/auth`,
    },
  },
} as const;

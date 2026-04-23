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

export const PROFESSIONAL = {
  BASE: 'professional',

  PROFILE: {
    CREATE: 'profile',
    ME: 'profile/me',
    BY_ID: (id = ':professionalId') => `profile/${id}`,
    VERIFY: (id = ':professionalId') => `profile/${id}/verify`,
    SUSPEND: (id = ':professionalId') => `profile/${id}/suspend`,
    REACTIVATE: (id = ':professionalId') => `profile/${id}/reactivate`,
    COMPLETION: (id = ':professionalId') => `profile/${id}/completion`,
  },

  LIST: '',
  SEARCH: 'search/query',
  BY_ID: (id = ':professionalId') => `${id}`,

  SERVICES: {
    LIST: (pid = ':professionalId') => `${pid}/services`,
    ADD: (pid = ':professionalId') => `${pid}/services`,
    UPDATE: (sid = ':serviceId') => `services/${sid}`,
    DELETE: (pid = ':professionalId', sid = ':serviceId') => `${pid}/services/${sid}`,
    ACTIVATE: (pid = ':professionalId', sid = ':serviceId') => `${pid}/services/${sid}/activate`,
    DEACTIVATE: (pid = ':professionalId', sid = ':serviceId') => `${pid}/services/${sid}/deactivate`,
    SET_COMMUNE_FEE: (pid = ':professionalId', sid = ':serviceId') => `${pid}/services/${sid}/communes`,
  },

  AVAILABILITY: {
    GET: (pid = ':professionalId') => `${pid}/availability`,
    SET: (pid = ':professionalId') => `${pid}/availability`,
    SET_WEEK: (pid = ':professionalId') => `${pid}/availability`,
    UPDATE: (pid = ':professionalId', day = ':dayOfWeek') => `${pid}/availability/${day}`,
    SET_STATUS: (pid = ':professionalId', day = ':dayOfWeek') => `${pid}/availability/${day}/status`,
    REMOVE: (pid = ':professionalId', day = ':dayOfWeek') => `${pid}/availability/${day}`,
  },

  GALLERY: {
    LIST: (pid = ':professionalId') => `${pid}/gallery`,
    UPLOAD: (pid = ':professionalId') => `${pid}/gallery`,
    REORDER: (pid = ':professionalId') => `${pid}/gallery/reorder`,
    UPDATE: (pid = ':professionalId', iid = ':itemId') => `${pid}/gallery/${iid}`,
    PUBLISH: (pid = ':professionalId', iid = ':itemId') => `${pid}/gallery/${iid}/publish`,
    UNPUBLISH: (pid = ':professionalId', iid = ':itemId') => `${pid}/gallery/${iid}/unpublish`,
    DELETE: (pid = ':professionalId', iid = ':itemId') => `${pid}/gallery/${iid}`,
  },

  BOOKINGS: {
    LIST: (pid = ':professionalId') => `${pid}/bookings`,
    CONFIRM: (pid = ':professionalId', bid = ':bookingId') => `${pid}/bookings/${bid}/confirm`,
    REJECT: (pid = ':professionalId', bid = ':bookingId') => `${pid}/bookings/${bid}/reject`,
    COMPLETE: (pid = ':professionalId', bid = ':bookingId') => `${pid}/bookings/${bid}/complete`,
  },
} as const;


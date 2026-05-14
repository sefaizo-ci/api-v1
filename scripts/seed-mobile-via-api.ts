import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const BASE_URL =
  process.env.SEED_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const API_KEY = process.env.SEED_API_KEY ?? process.env.API_KEY;
const ADMIN_ACCESS_TOKEN = process.env.SEED_ADMIN_ACCESS_TOKEN;
const OTP_CODE = process.env.SEED_OTP_CODE ?? '0000';
const PIN = '9898';
const RESET_BEFORE_SEED = (process.env.SEED_DEMO_RESET ?? 'false') === 'true';
const DATABASE_URL = process.env.DATABASE_URL;

const googleDriveImage = (fileId: string) =>
  `https://drive.google.com/uc?export=view&id=${fileId}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseOtpCooldownSeconds(errorMessage: string): number | null {
  const match = errorMessage.match(/Patientez\s+(\d+)s/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function normalizeCiPhone(input: string): string {
  const raw = input.trim();

  // Keep only digits to support values with or without separators/spaces.
  const digits = raw.replace(/\D/g, '');

  // Already normalized E.164 CI format: +225XXXXXXXXXX
  if (raw.startsWith('+225') && /^\+225\d{10}$/.test(raw)) {
    return raw;
  }

  // Local CI format with 10 digits.
  if (/^\d{10}$/.test(digits)) {
    return `+225${digits}`;
  }

  // Provided dataset format (12 digits) -> keep the last 10 digits.
  // Example: 070101010101 -> 0101010101 -> +2250101010101
  if (/^\d{12}$/.test(digits)) {
    return `+225${digits.slice(-10)}`;
  }

  throw new Error(
    `Unsupported phone format for seed: "${input}". Expected +225XXXXXXXXXX, 10-digit local, or 12-digit demo format.`,
  );
}

const PROFILE_LOGO_BLACK =
  process.env.SEED_PRO_AVATAR_BLACK_PATH ??
  googleDriveImage('1EkUISao_TgvokWxHCvtQfwcWdrBKHw34');
const PROFILE_LOGO_WHITE =
  process.env.SEED_PRO_AVATAR_WHITE_PATH ??
  googleDriveImage('1oOKVL_0oqHNm6HxoSr-ebYz_DCxYssk5');

if (!API_KEY) {
  throw new Error('Missing API key: set SEED_API_KEY (or API_KEY).');
}

type AppKind = 'CLIENT' | 'PROFESSIONAL';

type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  userId?: string;
  app: AppKind;
  phone: string;
};

type ProfessionalSeed = {
  key: string;
  phone: string;
  firstName: string;
  lastName: string;
  profile: {
    agencyName: string;
    bio: string;
    location: 'HOME' | 'SALON' | 'BOTH';
    address: string;
    latitude: number;
    longitude: number;
    avatarPath: string;
  };
  availability: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    breakStartTime?: string;
    breakEndTime?: string;
  }>;
};

type ClientSeed = {
  key: string;
  phone: string;
  firstName: string;
  lastName: string;
};

type ServiceSeed = {
  key: string;
  professionalKey: string;
  name: string;
  description: string;
  durationMin: number;
  basePrice: number;
  categoryPreferred: string;
  imageUrl: string;
};

type BookingSeed = {
  key: string;
  clientKey: string;
  professionalKey: string;
  serviceKey: string;
  scheduledAt: string;
  commune: string;
  address: string;
  clientNotes?: string;
  finalStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  rejectReason?: string;
};

const PROFESSIONALS: ProfessionalSeed[] = [
  {
    key: 'pro-home',
    phone: '070101010101',
    firstName: 'Awa',
    lastName: 'Kouame',
    profile: {
      agencyName: 'Sefaizo Home Care',
      bio: 'Beauty services at home with punctual and clean execution.',
      location: 'HOME',
      address: 'Cocody Angre 7e tranche, Abidjan',
      latitude: 5.3984,
      longitude: -3.9643,
      avatarPath: PROFILE_LOGO_BLACK,
    },
    availability: [
      {
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '17:00',
        breakStartTime: '12:30',
        breakEndTime: '13:30',
      },
      {
        dayOfWeek: 2,
        startTime: '08:00',
        endTime: '17:00',
        breakStartTime: '12:30',
        breakEndTime: '13:30',
      },
      {
        dayOfWeek: 3,
        startTime: '08:00',
        endTime: '17:00',
        breakStartTime: '12:30',
        breakEndTime: '13:30',
      },
      {
        dayOfWeek: 4,
        startTime: '08:00',
        endTime: '17:00',
        breakStartTime: '12:30',
        breakEndTime: '13:30',
      },
      {
        dayOfWeek: 5,
        startTime: '08:00',
        endTime: '17:00',
        breakStartTime: '12:30',
        breakEndTime: '13:30',
      },
      { dayOfWeek: 6, startTime: '09:00', endTime: '14:00' },
    ],
  },
  {
    key: 'pro-salon',
    phone: '070101010102',
    firstName: 'Nadia',
    lastName: 'Yao',
    profile: {
      agencyName: 'Sefaizo Salon Center',
      bio: 'Salon focused on hair care and clean customer flow.',
      location: 'SALON',
      address: 'Marcory Zone 4, Abidjan',
      latitude: 5.2923,
      longitude: -3.9837,
      avatarPath: PROFILE_LOGO_WHITE,
    },
    availability: [
      {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '19:00',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
      },
      {
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '19:00',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
      },
      {
        dayOfWeek: 3,
        startTime: '09:00',
        endTime: '19:00',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
      },
      {
        dayOfWeek: 4,
        startTime: '09:00',
        endTime: '19:00',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
      },
      {
        dayOfWeek: 5,
        startTime: '09:00',
        endTime: '19:00',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
      },
      { dayOfWeek: 6, startTime: '10:00', endTime: '16:00' },
    ],
  },
  {
    key: 'pro-both',
    phone: '070101010103',
    firstName: 'Mariam',
    lastName: 'Bamba',
    profile: {
      agencyName: 'Sefaizo Mixed Studio',
      bio: 'Hybrid operations with salon and at-home appointments.',
      location: 'BOTH',
      address: 'Riviera Golf, Cocody, Abidjan',
      latitude: 5.3675,
      longitude: -3.9512,
      avatarPath: PROFILE_LOGO_BLACK,
    },
    availability: [
      {
        dayOfWeek: 1,
        startTime: '09:30',
        endTime: '18:30',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
      },
      {
        dayOfWeek: 2,
        startTime: '09:30',
        endTime: '18:30',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
      },
      {
        dayOfWeek: 3,
        startTime: '09:30',
        endTime: '18:30',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
      },
      {
        dayOfWeek: 4,
        startTime: '09:30',
        endTime: '18:30',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
      },
      {
        dayOfWeek: 5,
        startTime: '09:30',
        endTime: '18:30',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
      },
    ],
  },
];

const CLIENTS: ClientSeed[] = [
  {
    key: 'client-a',
    phone: '070101010110',
    firstName: 'Jean',
    lastName: 'Koffi',
  },
  {
    key: 'client-b',
    phone: '070101010109',
    firstName: 'Fatou',
    lastName: 'Diallo',
  },
  {
    key: 'client-dual',
    phone: '070101010102',
    firstName: 'Nadia',
    lastName: 'Yao',
  },
];

const SERVICE_IMAGES = [
  googleDriveImage('1ttS9jd6E0_oen66ftKYVTHSMMN5otLh5'),
  googleDriveImage('1yKiSw8Z1JTpIYuqysNTZZNx-4anwF2SG'),
  googleDriveImage('1SzesuPujtmyWhELsOix69xjxyjiFM2D6'),
  googleDriveImage('1nK070LMJAqxmkOyQsqbRk6DbA3Dpmj_G'),
  googleDriveImage('1aMUeN-NK8beMUvkhcgjasyLtIjitgoxM'),
  googleDriveImage('1cAjvh9MXxvFBuU8u7UIRb6dnzzIjfydI'),
  googleDriveImage('1MUZ4WEXJVjqhuRnGF2jU_6aczeAaShzk'),
  googleDriveImage('1EkUISao_TgvokWxHCvtQfwcWdrBKHw34'),
];

const SERVICES: ServiceSeed[] = [
  {
    key: 'svc-home-1',
    professionalKey: 'pro-home',
    name: 'Brushing a domicile',
    description: 'Wash, blow-dry and finish at home.',
    durationMin: 90,
    basePrice: 10000,
    categoryPreferred: 'Coiffure & soins capillaires',
    imageUrl: SERVICE_IMAGES[0],
  },
  {
    key: 'svc-home-2',
    professionalKey: 'pro-home',
    name: 'Soin capillaire profond',
    description: 'Deep hair treatment session.',
    durationMin: 120,
    basePrice: 15000,
    categoryPreferred: 'Coiffure & soins capillaires',
    imageUrl: SERVICE_IMAGES[1],
  },
  {
    key: 'svc-home-3',
    professionalKey: 'pro-home',
    name: 'Knotless medium',
    description: 'Medium knotless braids.',
    durationMin: 240,
    basePrice: 28000,
    categoryPreferred: 'Tresses & coiffures africaines',
    imageUrl: SERVICE_IMAGES[2],
  },
  {
    key: 'svc-salon-1',
    professionalKey: 'pro-salon',
    name: 'Coupe + shampooing salon',
    description: 'Haircut with shampoo in salon.',
    durationMin: 60,
    basePrice: 8000,
    categoryPreferred: 'Coiffure & soins capillaires',
    imageUrl: SERVICE_IMAGES[3],
  },
  {
    key: 'svc-salon-2',
    professionalKey: 'pro-salon',
    name: 'Soin visage hydratant',
    description: 'Hydrating face care session.',
    durationMin: 75,
    basePrice: 12000,
    categoryPreferred: 'Soins du visage & esthetique',
    imageUrl: SERVICE_IMAGES[4],
  },
  {
    key: 'svc-both-1',
    professionalKey: 'pro-both',
    name: 'Maquillage soiree',
    description: 'Event make-up with long hold.',
    durationMin: 60,
    basePrice: 18000,
    categoryPreferred: 'Maquillage',
    imageUrl: SERVICE_IMAGES[0],
  },
];

const BOOKINGS: BookingSeed[] = [
  {
    key: 'booking-confirmed-1',
    clientKey: 'client-a',
    professionalKey: 'pro-home',
    serviceKey: 'svc-home-1',
    scheduledAt: '2026-05-20T09:00:00.000Z',
    commune: 'Cocody',
    address: 'Riviera 3, Abidjan',
    clientNotes: 'Please confirm quickly.',
    finalStatus: 'CONFIRMED',
  },
  {
    key: 'booking-pending-1',
    clientKey: 'client-b',
    professionalKey: 'pro-salon',
    serviceKey: 'svc-salon-1',
    scheduledAt: '2026-05-21T14:00:00.000Z',
    commune: 'Marcory',
    address: 'Zone 4, boulevard principal',
    clientNotes: 'I prefer a short clean style.',
    finalStatus: 'PENDING',
  },
  {
    key: 'booking-rejected-1',
    clientKey: 'client-dual',
    professionalKey: 'pro-home',
    serviceKey: 'svc-home-2',
    scheduledAt: '2026-05-22T10:00:00.000Z',
    commune: 'Plateau',
    address: 'Avenue Chardy, Abidjan',
    clientNotes: 'Urgent please.',
    finalStatus: 'CANCELLED',
    rejectReason: 'Rejected by professional during seed.',
  },
];

function allDemoPhones(): string[] {
  return Array.from(
    new Set([
      ...PROFESSIONALS.flatMap((p) => [p.phone, normalizeCiPhone(p.phone)]),
      ...CLIENTS.flatMap((c) => [c.phone, normalizeCiPhone(c.phone)]),
    ]),
  );
}

async function purgeDemoDatasetViaDatabase(): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error(
      'SEED_DEMO_RESET=true requires DATABASE_URL. Missing DATABASE_URL.',
    );
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const phones = allDemoPhones();

    const phoneRows = await prisma.phoneNumber.findMany({
      where: { number: { in: phones } },
      select: {
        id: true,
        clientUserId: true,
        professionalUserId: true,
      },
    });

    if (phoneRows.length === 0) {
      console.log(
        '[seed-mobile-via-api] reset: no demo phones found, skip purge.',
      );
      return;
    }

    const phoneIds = phoneRows.map((p) => p.id);

    const usersFromPhones = await prisma.user.findMany({
      where: { phoneId: { in: phoneIds } },
      select: { id: true },
    });

    const userIdSet = new Set<string>();
    for (const row of phoneRows) {
      if (row.clientUserId) userIdSet.add(row.clientUserId);
      if (row.professionalUserId) userIdSet.add(row.professionalUserId);
    }
    for (const user of usersFromPhones) {
      userIdSet.add(user.id);
    }

    const userIds = Array.from(userIdSet);

    const proRows = await prisma.professional.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const professionalIds = proRows.map((p) => p.id);

    const serviceRows = await prisma.serviceOffering.findMany({
      where: { professionalId: { in: professionalIds } },
      select: { id: true },
    });
    const serviceIds = serviceRows.map((s) => s.id);

    const bookingRows = await prisma.booking.findMany({
      where: {
        OR: [
          { clientId: { in: userIds } },
          { professionalId: { in: professionalIds } },
        ],
      },
      select: { id: true },
    });
    const bookingIds = bookingRows.map((b) => b.id);

    await prisma.review.deleteMany({
      where: {
        OR: [
          { bookingId: { in: bookingIds } },
          { professionalId: { in: professionalIds } },
        ],
      },
    });

    await prisma.booking.deleteMany({
      where: {
        OR: [
          { clientId: { in: userIds } },
          { professionalId: { in: professionalIds } },
        ],
      },
    });

    await prisma.communeFee.deleteMany({
      where: { serviceOfferingId: { in: serviceIds } },
    });

    await prisma.serviceOffering.deleteMany({
      where: { id: { in: serviceIds } },
    });

    await prisma.galleryItem.deleteMany({
      where: { professionalId: { in: professionalIds } },
    });

    await prisma.availability.deleteMany({
      where: { professionalId: { in: professionalIds } },
    });

    await prisma.serviceCategoryRequest.deleteMany({
      where: {
        OR: [
          { professionalId: { in: professionalIds } },
          { reviewedByUserId: { in: userIds } },
        ],
      },
    });

    await prisma.professional.deleteMany({
      where: { id: { in: professionalIds } },
    });

    await prisma.notificationDevice.deleteMany({
      where: { userId: { in: userIds } },
    });

    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });

    await prisma.deviceAuthentication.deleteMany({
      where: { userId: { in: userIds } },
    });

    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });

    await prisma.authLog.deleteMany({
      where: { userId: { in: userIds } },
    });

    await prisma.challenge.deleteMany({
      where: {
        OR: [{ phoneNumberId: { in: phoneIds } }, { userId: { in: userIds } }],
      },
    });

    await prisma.device.deleteMany({
      where: { userId: { in: userIds } },
    });

    await prisma.clientSecret.deleteMany({
      where: { clientId: { in: userIds } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });

    await prisma.phoneNumber.deleteMany({
      where: { id: { in: phoneIds } },
    });

    console.log(
      `[seed-mobile-via-api] reset: purged ${phones.length} phones, ${userIds.length} users, ${professionalIds.length} professionals.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function api<T = unknown>(
  method: string,
  path: string,
  opts?: {
    token?: string;
    json?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
    body?: BodyInit;
    contentType?: string;
    allowNotFound?: boolean;
  },
): Promise<{ status: number; data: T | null }> {
  const url = new URL(path, BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`);

  if (opts?.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = new Headers();
  headers.set('x-api-key', API_KEY!);

  if (opts?.token) {
    headers.set('Authorization', `Bearer ${opts.token}`);
  }

  let body: BodyInit | undefined = opts?.body;

  if (opts?.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.json);
  } else if (opts?.contentType) {
    headers.set('Content-Type', opts.contentType);
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  if (opts?.allowNotFound && response.status === 404) {
    return { status: response.status, data: null };
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : null;

  if (!response.ok) {
    const payload = data as {
      message?: string | string[] | Record<string, unknown>;
    } | null;
    const detail = (() => {
      if (!payload?.message) return undefined;
      if (typeof payload.message === 'string') return payload.message;
      if (Array.isArray(payload.message)) return payload.message.join(' | ');
      return JSON.stringify(payload.message);
    })();
    const fallback = text || 'No response payload';
    throw new Error(
      `${method} ${path} failed with ${response.status}${detail ? ` - ${detail}` : ` - ${fallback}`}`,
    );
  }

  return { status: response.status, data };
}

async function sendOtpWithRetry(
  phone: string,
  app: AppKind,
  purpose: 'REGISTRATION',
): Promise<void> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await api('POST', 'sentinel/otp/send', {
        json: { phone, purpose, app },
      });
      return;
    } catch (error) {
      const message = (error as Error).message;
      const isRateLimit = message.includes('failed with 429');

      if (!isRateLimit || attempt === maxAttempts) {
        throw error;
      }

      const cooldown = parseOtpCooldownSeconds(message) ?? 60;
      const waitSeconds = Math.min(cooldown + 1, 90);
      console.log(
        `[seed-mobile-via-api] OTP cooldown detected for ${phone}. Waiting ${waitSeconds}s before retry ${attempt + 1}/${maxAttempts}.`,
      );
      await sleep(waitSeconds * 1000);
    }
  }
}

function pickString(obj: unknown, paths: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  const source = obj as Record<string, unknown>;

  for (const path of paths) {
    const chunks = path.split('.');
    let cur: unknown = source;
    for (const chunk of chunks) {
      if (!cur || typeof cur !== 'object') {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[chunk];
    }
    if (typeof cur === 'string' && cur.length > 0) {
      return cur;
    }
  }

  return undefined;
}

async function authenticateAccount(
  app: AppKind,
  phone: string,
  firstName: string,
  lastName: string,
): Promise<AuthSession> {
  const normalizedPhone = normalizeCiPhone(phone);

  const init = await api<{ nextStep: 'OTP' | 'PIN_THEN_OTP' }>(
    'POST',
    'sentinel/flow/init',
    {
      json: { phone: normalizedPhone, app },
    },
  );

  let accessToken: string | undefined;
  let refreshToken: string | undefined;

  if (init.data?.nextStep === 'OTP') {
    await sendOtpWithRetry(normalizedPhone, app, 'REGISTRATION');

    const verify = await api<{ challengeToken: string }>(
      'POST',
      'sentinel/otp/verify',
      {
        json: {
          phone: normalizedPhone,
          code: OTP_CODE,
          purpose: 'REGISTRATION',
          app,
        },
      },
    );

    const challengeToken = verify.data?.challengeToken;
    if (!challengeToken) {
      throw new Error(
        `Missing challengeToken for registration (${normalizedPhone}, ${app}).`,
      );
    }

    const complete = await api<{ accessToken?: string; refreshToken?: string }>(
      'POST',
      'sentinel/pin/create',
      {
        token: challengeToken,
        json: {
          pin: PIN,
          confirmPin: PIN,
        },
      },
    );

    accessToken = complete.data?.accessToken;
    refreshToken = complete.data?.refreshToken;

    if (!accessToken) {
      throw new Error(
        `No accessToken returned from pin/create (${normalizedPhone}, ${app}).`,
      );
    }

    await api('PATCH', 'sentinel/me', {
      token: accessToken,
      json: { firstName, lastName },
    });

    await api('POST', 'sentinel/terms/accept', { token: accessToken });
  } else {
    const start = await api<{ challengeToken: string }>(
      'POST',
      'sentinel/login/start',
      {
        json: { phone: normalizedPhone, pin: PIN, app },
      },
    );

    const challengeToken = start.data?.challengeToken;
    if (!challengeToken) {
      throw new Error(
        `Missing challengeToken for login (${normalizedPhone}, ${app}).`,
      );
    }

    const complete = await api<{ accessToken?: string; refreshToken?: string }>(
      'POST',
      'sentinel/login/complete',
      {
        token: challengeToken,
        json: { code: OTP_CODE },
      },
    );

    accessToken = complete.data?.accessToken;
    refreshToken = complete.data?.refreshToken;

    if (!accessToken) {
      throw new Error(
        `No accessToken returned from login/complete (${normalizedPhone}, ${app}).`,
      );
    }

    await api('PATCH', 'sentinel/me', {
      token: accessToken,
      json: { firstName, lastName },
    });

    await api('POST', 'sentinel/terms/accept', { token: accessToken });
  }

  const me = await api('GET', 'sentinel/me', { token: accessToken });
  const userId = pickString(me.data, ['id', 'user.id']);

  return {
    accessToken,
    refreshToken,
    userId,
    app,
    phone: normalizedPhone,
  };
}

async function resolveProfessionalId(
  token: string,
): Promise<string | undefined> {
  const meProfile = await api('GET', 'professionals/profile/me', {
    token,
    allowNotFound: true,
  });

  if (meProfile.status === 404 || !meProfile.data) {
    return undefined;
  }

  return pickString(meProfile.data, [
    'id',
    'professional.id',
    'data.id',
    'data.professional.id',
  ]);
}

async function upsertProfessionalProfile(
  seed: ProfessionalSeed,
  session: AuthSession,
): Promise<string> {
  let professionalId = await resolveProfessionalId(session.accessToken);

  if (!professionalId) {
    const create = await api('POST', 'professionals/profile', {
      token: session.accessToken,
      json: {
        agencyName: seed.profile.agencyName,
        bio: seed.profile.bio,
        location: seed.profile.location,
        address: seed.profile.address,
        latitude: seed.profile.latitude,
        longitude: seed.profile.longitude,
      },
    });

    professionalId = pickString(create.data, [
      'id',
      'professional.id',
      'data.id',
    ]);
    if (!professionalId) {
      professionalId = await resolveProfessionalId(session.accessToken);
    }
  } else {
    await api('PUT', `professionals/profile/${professionalId}`, {
      token: session.accessToken,
      json: {
        agencyName: seed.profile.agencyName,
        bio: seed.profile.bio,
        location: seed.profile.location,
        address: seed.profile.address,
        latitude: seed.profile.latitude,
        longitude: seed.profile.longitude,
      },
    });
  }

  if (!professionalId) {
    throw new Error(`Unable to resolve professionalId for ${seed.phone}.`);
  }

  await api('POST', `professionals/${professionalId}/availability/bulk`, {
    token: session.accessToken,
    json: { availabilities: seed.availability },
  });

  await tryUploadAvatar(
    professionalId,
    seed.profile.avatarPath,
    session.accessToken,
  );

  return professionalId;
}

type ProfessionalState = {
  id?: string;
  isVerified?: boolean;
  status?: string;
};

function asProfessionalState(data: unknown): ProfessionalState {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;

  const id = pickString(obj, ['id', 'professional.id', 'data.id']);
  const statusValue = pickString(obj, [
    'status',
    'professional.status',
    'data.status',
  ]);

  const rawVerified =
    (obj.isVerified as boolean | undefined) ??
    ((obj.professional as Record<string, unknown> | undefined)?.isVerified as
      | boolean
      | undefined) ??
    ((obj.data as Record<string, unknown> | undefined)?.isVerified as
      | boolean
      | undefined);

  return {
    id,
    status: statusValue,
    isVerified: rawVerified,
  };
}

async function getProfessionalState(
  professionalId: string,
  professionalToken: string,
): Promise<ProfessionalState> {
  const me = await api('GET', 'professionals/profile/me', {
    token: professionalToken,
    allowNotFound: true,
  });

  const meState = asProfessionalState(me.data);
  if (meState.id === professionalId) {
    return meState;
  }

  const pub = await api('GET', `professionals/${professionalId}`, {
    allowNotFound: true,
  });
  return asProfessionalState(pub.data);
}

async function ensureProfessionalBookable(
  professionalId: string,
  professionalToken: string,
): Promise<void> {
  let state = await getProfessionalState(professionalId, professionalToken);
  const alreadyBookable =
    state.isVerified === true && state.status === 'ACTIVE';
  if (alreadyBookable) {
    return;
  }

  if (!ADMIN_ACCESS_TOKEN) {
    if (!DATABASE_URL) {
      throw new Error(
        `Professional ${professionalId} is not bookable (isVerified=${String(
          state.isVerified,
        )}, status=${String(
          state.status,
        )}). Provide SEED_ADMIN_ACCESS_TOKEN to auto-verify via API, or DATABASE_URL to verify directly via DB.`,
      );
    }

    console.log(
      `[seed] No SEED_ADMIN_ACCESS_TOKEN — verifying professional ${professionalId} directly via DATABASE_URL.`,
    );
    const pool = new Pool({ connectionString: DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });
    try {
      await prisma.professional.update({
        where: { id: professionalId },
        data: { isVerified: true, status: 'ACTIVE' },
      });
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  } else {
    await api('PUT', `professional/profile/${professionalId}/verify`, {
      token: ADMIN_ACCESS_TOKEN,
    });
  }

  state = await getProfessionalState(professionalId, professionalToken);
  const isBookable = state.isVerified === true && state.status === 'ACTIVE';
  if (!isBookable) {
    throw new Error(
      `Professional ${professionalId} is still not bookable after admin verify (isVerified=${String(
        state.isVerified,
      )}, status=${String(state.status)}).`,
    );
  }
}

async function tryUploadAvatar(
  professionalId: string,
  avatarPath: string,
  token: string,
): Promise<void> {
  try {
    let fileBuffer: Buffer;
    let fileName = 'avatar.png';
    let mimeType = 'image/png';

    if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
      const avatarResponse = await fetch(avatarPath);
      if (!avatarResponse.ok) {
        throw new Error(
          `avatar download failed with status ${avatarResponse.status}`,
        );
      }

      const arrayBuffer = await avatarResponse.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);

      const contentType =
        avatarResponse.headers.get('content-type')?.toLowerCase() ?? '';

      const looksLikeImage = contentType.startsWith('image/');
      const extension = contentType.includes('jpeg')
        ? 'jpg'
        : contentType.includes('webp')
          ? 'webp'
          : contentType.includes('gif')
            ? 'gif'
            : contentType.includes('png')
              ? 'png'
              : avatarPath.toLowerCase().includes('.jpg') ||
                  avatarPath.toLowerCase().includes('.jpeg')
                ? 'jpg'
                : avatarPath.toLowerCase().includes('.webp')
                  ? 'webp'
                  : avatarPath.toLowerCase().includes('.gif')
                    ? 'gif'
                    : 'png';

      mimeType =
        extension === 'jpg'
          ? 'image/jpeg'
          : extension === 'webp'
            ? 'image/webp'
            : extension === 'gif'
              ? 'image/gif'
              : 'image/png';
      fileName = `avatar.${extension}`;

      if (!looksLikeImage) {
        console.warn(
          `[WARN] Avatar source for professional ${professionalId} returned non-image content-type (${contentType || 'unknown'}). Forcing upload as ${mimeType}.`,
        );
      }

      const maxUploadBytes = 10 * 1024 * 1024;
      if (fileBuffer.byteLength > maxUploadBytes) {
        console.warn(
          `[WARN] Avatar upload skipped for professional ${professionalId}: file too large (${fileBuffer.byteLength} bytes > ${maxUploadBytes}).`,
        );
        return;
      }
    } else {
      fileBuffer = await readFile(avatarPath);

      const lower = avatarPath.toLowerCase();
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        mimeType = 'image/jpeg';
        fileName = 'avatar.jpg';
      } else if (lower.endsWith('.webp')) {
        mimeType = 'image/webp';
        fileName = 'avatar.webp';
      } else if (lower.endsWith('.gif')) {
        mimeType = 'image/gif';
        fileName = 'avatar.gif';
      }

      const maxUploadBytes = 10 * 1024 * 1024;
      if (fileBuffer.byteLength > maxUploadBytes) {
        console.warn(
          `[WARN] Avatar upload skipped for professional ${professionalId}: local file too large (${fileBuffer.byteLength} bytes > ${maxUploadBytes}).`,
        );
        return;
      }
    }

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(fileBuffer)], { type: mimeType }),
      fileName,
    );

    await api('POST', `professionals/${professionalId}/avatar/upload`, {
      token,
      body: form,
    });
  } catch (error) {
    console.warn(
      `[WARN] Avatar upload skipped for professional ${professionalId}: ${(error as Error).message}`,
    );
  }
}

async function listCategoryNames(): Promise<string[]> {
  const response = await api('GET', 'professionals/services/categories', {
    query: { page: 1, limit: 100 },
  });

  const rawData = (response.data as { data?: Array<{ name?: string }> } | null)
    ?.data;
  if (!Array.isArray(rawData)) {
    return [];
  }

  return rawData
    .map((item) => item.name)
    .filter(
      (name): name is string => typeof name === 'string' && name.length > 0,
    );
}

async function listProfessionalServices(
  professionalId: string,
): Promise<Array<{ id: string; name: string }>> {
  const response = await api(
    'GET',
    `professionals/${professionalId}/services`,
    {
      query: { includeInactive: true },
    },
  );

  const raw = response.data as
    | {
        services?: Array<{ id?: string; name?: string }>;
        data?: Array<{ id?: string; name?: string }>;
      }
    | Array<{ id?: string; name?: string }>
    | null;

  const arr = Array.isArray(raw) ? raw : (raw?.services ?? raw?.data ?? []);

  return arr
    .map((item) => ({ id: item.id ?? '', name: item.name ?? '' }))
    .filter((item) => item.id.length > 0 && item.name.length > 0);
}

async function upsertServices(
  categories: string[],
  professionalIds: Map<string, string>,
  sessions: Map<string, AuthSession>,
): Promise<Map<string, { id: string; professionalId: string }>> {
  const serviceIds = new Map<string, { id: string; professionalId: string }>();

  for (const service of SERVICES) {
    const professionalId = professionalIds.get(service.professionalKey);
    const session = sessions.get(service.professionalKey);

    if (!professionalId || !session) {
      throw new Error(
        `Missing professional context for ${service.professionalKey}.`,
      );
    }

    const existingServices = await listProfessionalServices(professionalId);
    const matched = existingServices.find(
      (s) => s.name.toLowerCase() === service.name.toLowerCase(),
    );

    const chosenCategory = categories.includes(service.categoryPreferred)
      ? service.categoryPreferred
      : (categories[0] ?? service.categoryPreferred);

    if (matched) {
      await api('PUT', `professionals/services/${matched.id}`, {
        token: session.accessToken,
        json: {
          name: service.name,
          description: service.description,
          durationMin: service.durationMin,
          basePrice: service.basePrice,
          category: chosenCategory,
          imageUrl: service.imageUrl,
        },
      });
      serviceIds.set(service.key, { id: matched.id, professionalId });
      continue;
    }

    const created = await api(
      'POST',
      `professionals/${professionalId}/services`,
      {
        token: session.accessToken,
        json: {
          name: service.name,
          description: service.description,
          durationMin: service.durationMin,
          basePrice: service.basePrice,
          category: chosenCategory,
          imageUrl: service.imageUrl,
        },
      },
    );

    const serviceId = pickString(created.data, ['id', 'service.id', 'data.id']);
    if (!serviceId) {
      throw new Error(`Service creation returned no id for ${service.name}.`);
    }

    serviceIds.set(service.key, { id: serviceId, professionalId });
  }

  return serviceIds;
}

async function listClientBookings(
  token: string,
): Promise<Array<Record<string, unknown>>> {
  const response = await api('GET', 'clients/me/bookings', {
    token,
    query: { page: 1, limit: 100 },
  });

  const raw = response.data as
    | { data?: Array<Record<string, unknown>> }
    | Array<Record<string, unknown>>
    | null;

  return Array.isArray(raw) ? raw : (raw?.data ?? []);
}

function bookingMatches(
  item: Record<string, unknown>,
  professionalId: string,
  serviceId: string,
  scheduledAt: string,
): boolean {
  const itemPro = pickString(item, [
    'professionalId',
    'professional.id',
    'data.professionalId',
  ]);
  const itemSvc = pickString(item, [
    'serviceId',
    'service.id',
    'data.serviceId',
  ]);
  const itemScheduled = pickString(item, ['scheduledAt', 'data.scheduledAt']);

  return (
    itemPro === professionalId &&
    itemSvc === serviceId &&
    itemScheduled === scheduledAt
  );
}

async function createOrFindBooking(
  booking: BookingSeed,
  clientSession: AuthSession,
  professionalId: string,
  serviceId: string,
): Promise<string> {
  const existing = await listClientBookings(clientSession.accessToken);
  const found = existing.find((b) =>
    bookingMatches(b, professionalId, serviceId, booking.scheduledAt),
  );

  if (found) {
    const id = pickString(found, ['id', 'data.id']);
    if (id) {
      return id;
    }
  }

  const created = await api('POST', 'clients/me/bookings', {
    token: clientSession.accessToken,
    json: {
      professionalId,
      serviceId,
      scheduledAt: booking.scheduledAt,
      commune: booking.commune,
      address: booking.address,
      clientNotes: booking.clientNotes,
    },
  });

  const bookingId = pickString(created.data, ['id', 'data.id']);
  if (!bookingId) {
    throw new Error(`Booking creation returned no id for ${booking.key}.`);
  }

  return bookingId;
}

async function moveBookingToTargetStatus(
  booking: BookingSeed,
  bookingId: string,
  professionalId: string,
  professionalSession: AuthSession,
): Promise<void> {
  if (booking.finalStatus === 'PENDING') {
    return;
  }

  if (booking.finalStatus === 'CONFIRMED') {
    await api(
      'PUT',
      `professionals/${professionalId}/bookings/${bookingId}/confirm`,
      {
        token: professionalSession.accessToken,
      },
    );
    return;
  }

  // CANCELLED = rejected by professional via the reject endpoint
  await api(
    'PUT',
    `professionals/${professionalId}/bookings/${bookingId}/reject`,
    {
      token: professionalSession.accessToken,
      json: {
        reason: booking.rejectReason ?? 'Rejected by professional.',
      },
    },
  );
}

async function main(): Promise<void> {
  console.log('\n[seed-mobile-via-api] start\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Assumption: OTP_DEV_MODE=true so OTP code is 0000 by default.');

  if (RESET_BEFORE_SEED) {
    console.log(
      '[seed-mobile-via-api] reset mode enabled: purge demo dataset before reseed.',
    );
    console.log(
      '[seed-mobile-via-api] note: no dedicated API endpoint exists for full dataset purge, using targeted DB cleanup for demo phones.',
    );
    await purgeDemoDatasetViaDatabase();
  }

  const sessions = new Map<string, AuthSession>();
  const professionalIds = new Map<string, string>();

  for (const pro of PROFESSIONALS) {
    const session = await authenticateAccount(
      'PROFESSIONAL',
      pro.phone,
      pro.firstName,
      pro.lastName,
    );
    sessions.set(pro.key, session);

    const professionalId = await upsertProfessionalProfile(pro, session);
    await ensureProfessionalBookable(professionalId, session.accessToken);
    professionalIds.set(pro.key, professionalId);

    console.log(
      `PRO ready: ${pro.phone} (API: ${normalizeCiPhone(pro.phone)}) -> ${professionalId}`,
    );
  }

  for (const client of CLIENTS) {
    const session = await authenticateAccount(
      'CLIENT',
      client.phone,
      client.firstName,
      client.lastName,
    );
    sessions.set(client.key, session);
    console.log(
      `CLIENT ready: ${client.phone} (API: ${normalizeCiPhone(client.phone)})`,
    );
  }

  const categories = await listCategoryNames();
  if (categories.length === 0) {
    throw new Error(
      'No service category found from GET /professionals/services/categories. Seed cannot add services.',
    );
  }

  const serviceIds = await upsertServices(
    categories,
    professionalIds,
    sessions,
  );
  console.log(`Services ready: ${serviceIds.size}`);

  for (const booking of BOOKINGS) {
    const clientSession = sessions.get(booking.clientKey);
    const professionalSession = sessions.get(booking.professionalKey);
    const professionalId = professionalIds.get(booking.professionalKey);
    const service = serviceIds.get(booking.serviceKey);

    if (!clientSession || !professionalSession || !professionalId || !service) {
      throw new Error(`Missing booking context for ${booking.key}.`);
    }

    const bookingId = await createOrFindBooking(
      booking,
      clientSession,
      professionalId,
      service.id,
    );

    await moveBookingToTargetStatus(
      booking,
      bookingId,
      professionalId,
      professionalSession,
    );

    console.log(
      `Booking ready: ${booking.key} -> ${booking.finalStatus} (${bookingId})`,
    );
  }

  console.log('\n[seed-mobile-via-api] done\n');
  console.log('Accounts used PIN 9898 for both PROFESSIONAL and CLIENT apps.');
  console.log('Professional phones: 070101010101, 070101010102, 070101010103');
  console.log('Client phones: 070101010110, 070101010109, 070101010102');
  console.log(
    'Bookings target statuses: CONFIRMED, PENDING, CANCELLED (rejected by professional).\n',
  );
}

main().catch((error: unknown) => {
  console.error('[seed-mobile-via-api] failed:', error);
  process.exit(1);
});

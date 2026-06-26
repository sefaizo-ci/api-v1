import { AvailabilityEntity } from '../../core/entities/availability.entity';
import { AvailabilityStatus } from '../../core/enums';

/**
 * Côte d'Ivoire (Abidjan) is UTC+0 year-round with no daylight saving, so the
 * local wall-clock equals UTC. We compute "now" from the UTC getters and label
 * the result with this timezone so the contract is explicit for clients.
 */
const SCHEDULE_TIMEZONE = 'Africa/Abidjan';

/** Index 0..6 → French day name. Matches JS getUTCDay() / availability.dayOfWeek (0 = Sunday). */
const DAY_NAMES_FR = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
] as const;

const CLOSED_LABEL = 'Fermé';

/**
 * `DaySlot.status` is a plain string (it also carries lean prisma rows), so we
 * compare against the enum's string value to keep the lint enum-safety rule happy.
 */
const OPEN_STATUS: string = AvailabilityStatus.OPEN;

/** Display order: Monday(1)…Saturday(6) then Sunday(0). */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Normalized day availability. Decoupled from the domain entity so the same
 * open/closed logic serves both the aggregate (detail) and lean prisma rows
 * (discovery lists).
 */
export type DaySlot = {
  dayOfWeek: number;
  status: string;
  startTime: string;
  endTime: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
};

export type OpenStatus = {
  /** Whether the professional is open right now (today's hours, excluding break). */
  isOpen: boolean;
  /** Today's closing time ("HH:mm") when currently open, else null. */
  closingTime: string | null;
};

export type ScheduleDay = {
  dayOfWeek: number;
  dayName: string;
  isOpen: boolean;
  startTime: string | null;
  endTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  /** Human-readable summary, e.g. "09:00-20:00" or "Fermé". */
  label: string;
};

export type SchedulePresentation = OpenStatus & {
  timezone: string;
  /** Full week, ordered Monday→Sunday for display. */
  days: ScheduleDay[];
};

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function isWithin(
  nowMin: number,
  startTime: string,
  endTime: string,
  breakStartTime?: string | null,
  breakEndTime?: string | null,
): boolean {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (nowMin < start || nowMin >= end) return false;
  if (breakStartTime && breakEndTime) {
    const bStart = toMinutes(breakStartTime);
    const bEnd = toMinutes(breakEndTime);
    if (nowMin >= bStart && nowMin < bEnd) return false;
  }
  return true;
}

/** Adapt domain availability entities to the normalized {@link DaySlot} shape. */
export function daySlotsFromAvailabilities(
  availabilities: AvailabilityEntity[],
): DaySlot[] {
  return availabilities.map((a) => ({
    dayOfWeek: a.dayOfWeek,
    status: a.status,
    startTime: a.workingHours.startTime,
    endTime: a.workingHours.endTime,
    breakStartTime: a.breakTime?.startTime ?? null,
    breakEndTime: a.breakTime?.endTime ?? null,
  }));
}

/**
 * Whether the professional is open at {@link now}, based on today's OPEN slot.
 * Cheap enough to call per item when building list responses.
 */
export function computeOpenNow(
  slots: DaySlot[],
  now: Date = new Date(),
): OpenStatus {
  const todayDow = now.getUTCDay();
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  const today = slots.find(
    (s) => s.dayOfWeek === todayDow && s.status === OPEN_STATUS,
  );
  if (!today) return { isOpen: false, closingTime: null };

  const open = isWithin(
    nowMin,
    today.startTime,
    today.endTime,
    today.breakStartTime,
    today.breakEndTime,
  );
  return { isOpen: open, closingTime: open ? today.endTime : null };
}

/**
 * Build the open/closed status + a display-ready weekly schedule. Days without
 * an OPEN slot are reported as closed. Time is evaluated in {@link SCHEDULE_TIMEZONE}.
 */
export function buildSchedule(
  slots: DaySlot[],
  now: Date = new Date(),
): SchedulePresentation {
  const byDay = new Map<number, DaySlot>();
  for (const s of slots) {
    if (s.status === OPEN_STATUS) byDay.set(s.dayOfWeek, s);
  }

  const days: ScheduleDay[] = DISPLAY_ORDER.map((dow) => {
    const s = byDay.get(dow);
    if (!s) {
      return {
        dayOfWeek: dow,
        dayName: DAY_NAMES_FR[dow],
        isOpen: false,
        startTime: null,
        endTime: null,
        breakStartTime: null,
        breakEndTime: null,
        label: CLOSED_LABEL,
      };
    }
    return {
      dayOfWeek: dow,
      dayName: DAY_NAMES_FR[dow],
      isOpen: true,
      startTime: s.startTime,
      endTime: s.endTime,
      breakStartTime: s.breakStartTime ?? null,
      breakEndTime: s.breakEndTime ?? null,
      label: `${s.startTime}-${s.endTime}`,
    };
  });

  return {
    timezone: SCHEDULE_TIMEZONE,
    ...computeOpenNow(slots, now),
    days,
  };
}

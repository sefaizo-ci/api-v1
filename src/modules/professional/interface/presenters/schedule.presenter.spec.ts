import {
  buildSchedule,
  computeOpenNow,
  daySlotsFromAvailabilities,
  type DaySlot,
} from './schedule.presenter';
import {
  AvailabilityEntity,
  TimeRangeVO,
} from '../../core/entities/availability.entity';
import { AvailabilityStatus } from '../../core/enums';

// A Thursday at 14:30 UTC (== Abidjan local). getUTCDay() => 4.
const THURSDAY_1430 = new Date('2026-06-25T14:30:00.000Z');

function slot(partial: Partial<DaySlot> & { dayOfWeek: number }): DaySlot {
  return {
    status: AvailabilityStatus.OPEN,
    startTime: '09:00',
    endTime: '18:00',
    breakStartTime: null,
    breakEndTime: null,
    ...partial,
  };
}

describe('computeOpenNow', () => {
  it('is open during working hours and reports the closing time', () => {
    const res = computeOpenNow([slot({ dayOfWeek: 4 })], THURSDAY_1430);
    expect(res).toEqual({ isOpen: true, closingTime: '18:00' });
  });

  it('is closed before opening', () => {
    const res = computeOpenNow(
      [slot({ dayOfWeek: 4, startTime: '15:00', endTime: '18:00' })],
      THURSDAY_1430,
    );
    expect(res).toEqual({ isOpen: false, closingTime: null });
  });

  it('is closed during the break window', () => {
    const res = computeOpenNow(
      [
        slot({
          dayOfWeek: 4,
          breakStartTime: '14:00',
          breakEndTime: '15:00',
        }),
      ],
      THURSDAY_1430,
    );
    expect(res).toEqual({ isOpen: false, closingTime: null });
  });

  it('is closed when today has no slot', () => {
    const res = computeOpenNow([slot({ dayOfWeek: 2 })], THURSDAY_1430);
    expect(res).toEqual({ isOpen: false, closingTime: null });
  });

  it('treats a non-OPEN status as closed', () => {
    const res = computeOpenNow(
      [slot({ dayOfWeek: 4, status: AvailabilityStatus.ON_LEAVE })],
      THURSDAY_1430,
    );
    expect(res).toEqual({ isOpen: false, closingTime: null });
  });
});

describe('buildSchedule', () => {
  it('orders the week Monday→Sunday and labels closed days', () => {
    const res = buildSchedule([slot({ dayOfWeek: 4 })], THURSDAY_1430);
    expect(res.days.map((d) => d.dayName)).toEqual([
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
      'Dimanche',
    ]);
    const thursday = res.days.find((d) => d.dayOfWeek === 4)!;
    expect(thursday.label).toBe('09:00-18:00');
    const monday = res.days.find((d) => d.dayOfWeek === 1)!;
    expect(monday).toMatchObject({ isOpen: false, label: 'Fermé' });
    expect(res.isOpen).toBe(true);
    expect(res.timezone).toBe('Africa/Abidjan');
  });
});

describe('daySlotsFromAvailabilities', () => {
  it('maps domain availabilities to normalized slots', () => {
    const availability = new AvailabilityEntity({
      id: 'a1',
      professionalId: 'p1',
      dayOfWeek: 4,
      workingHours: new TimeRangeVO('09:00', '18:00'),
      breakTime: new TimeRangeVO('13:00', '14:00'),
      status: AvailabilityStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(daySlotsFromAvailabilities([availability])).toEqual([
      {
        dayOfWeek: 4,
        status: AvailabilityStatus.OPEN,
        startTime: '09:00',
        endTime: '18:00',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
      },
    ]);
  });
});

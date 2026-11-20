import type { PolicySettings, RoomReservation } from '../types/facility';

/**
 * South Korean statutory & substitute public holidays (2025–2028)
 */
export const KOREAN_PUBLIC_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-01-01': '신정',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-01': '삼일절',
  '2025-03-03': '삼일절 대체공휴일',
  '2025-05-05': '어린이날·부처님오신날',
  '2025-05-06': '대체공휴일',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴',
  '2025-10-06': '추석',
  '2025-10-07': '추석 연휴',
  '2025-10-08': '추석 대체공휴일',
  '2025-10-09': '한글날',
  '2025-12-25': '성탄절',

  // 2026
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '삼일절 대체공휴일',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '부처님오신날 대체공휴일',
  '2026-06-03': '지방선거일',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '광복절 대체공휴일',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절',
  '2026-10-05': '개천절 대체공휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',

  // 2027
  '2027-01-01': '신정',
  '2027-02-06': '설날 연휴',
  '2027-02-07': '설날',
  '2027-02-08': '설날 연휴',
  '2027-02-09': '설날 대체공휴일',
  '2027-03-01': '삼일절',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-08-15': '광복절',
  '2027-08-16': '광복절 대체공휴일',
  '2027-09-14': '추석 연휴',
  '2027-09-15': '추석',
  '2027-09-16': '추석 연휴',
  '2027-10-03': '개천절',
  '2027-10-04': '개천절 대체공휴일',
  '2027-10-09': '한글날',
  '2027-10-11': '한글날 대체공휴일',
  '2027-12-25': '성탄절',
  '2027-12-27': '성탄절 대체공휴일',

  // 2028
  '2028-01-01': '신정',
  '2028-01-26': '설날 연휴',
  '2028-01-27': '설날',
  '2028-01-28': '설날 연휴',
  '2028-03-01': '삼일절',
  '2028-05-02': '부처님오신날',
  '2028-05-05': '어린이날',
  '2028-06-06': '현충일',
  '2028-08-15': '광복절',
  '2028-10-02': '추석 연휴',
  '2028-10-03': '추석·개천절',
  '2028-10-04': '추석 연휴',
  '2028-10-05': '대체공휴일',
  '2028-10-09': '한글날',
  '2028-12-25': '성탄절',
};

export const OPERATING_START_HOUR = 9;
export const OPERATING_END_HOUR = 18;
export const OPERATING_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17] as const;

export const DEFAULT_POLICIES: PolicySettings = {
  cancel_deadline_minutes: 0,
  loan_day_calc_mode: 'calendar',
  max_loan_days: 3,
  max_room_hours: 4,
  booking_horizon_days: 30,
};

export function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseYMD(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function getTodayYMD(): string {
  return formatDateYMD(new Date());
}

export function addCalendarDays(dateStr: string, days: number): string {
  const dt = parseYMD(dateStr);
  dt.setDate(dt.getDate() + days);
  return formatDateYMD(dt);
}

export function isWeekend(dateStr: string): boolean {
  const day = parseYMD(dateStr).getDay();
  return day === 0 || day === 6;
}

export function getKoreanHolidayName(dateStr: string): string | null {
  return KOREAN_PUBLIC_HOLIDAYS[dateStr] ?? null;
}

export function isBusinessDay(dateStr: string): boolean {
  return !isWeekend(dateStr) && getKoreanHolidayName(dateStr) === null;
}

export function getNextBookableDateYMD(): string {
  const now = new Date();
  let candidate = formatDateYMD(now);
  // If after 17:00 today, start from tomorrow so at least one 1-hour slot is available
  if (now.getHours() >= 17) {
    candidate = addCalendarDays(candidate, 1);
  }
  for (let i = 0; i < 15; i += 1) {
    if (isBusinessDay(candidate)) {
      return candidate;
    }
    candidate = addCalendarDays(candidate, 1);
  }
  return candidate;
}

export function getDefaultStartHour(dateStr: string): number {
  const now = new Date();
  const today = formatDateYMD(now);
  if (dateStr === today) {
    const nextHour = now.getMinutes() > 0 ? now.getHours() + 1 : now.getHours();
    return Math.min(Math.max(nextHour, OPERATING_START_HOUR), OPERATING_END_HOUR - 1);
  }
  return OPERATING_START_HOUR;
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatKoreanDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr;
  const dt = parseYMD(dateStr.slice(0, 10));
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일 (${weekdays[dt.getDay()]})`;
}

export function diffCalendarDays(startDateStr: string, endDateStr: string): number {
  const start = parseYMD(startDateStr.slice(0, 10));
  const end = parseYMD(endDateStr.slice(0, 10));
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function countBusinessDaysBetween(startDateStr: string, endDateStr: string): number {
  const start = startDateStr.slice(0, 10);
  const end = endDateStr.slice(0, 10);
  if (end < start) return -1;
  let count = 0;
  let cursor = start;
  while (cursor < end) {
    cursor = addCalendarDays(cursor, 1);
    if (isBusinessDay(cursor)) {
      count += 1;
    }
  }
  return count;
}

export function getMaxLoanDueDate(startDateStr: string, policies: PolicySettings): string {
  const maxDays = policies.max_loan_days || 3;
  if (policies.loan_day_calc_mode === 'business') {
    let cursor = startDateStr.slice(0, 10);
    let added = 0;
    while (added < maxDays) {
      cursor = addCalendarDays(cursor, 1);
      if (isBusinessDay(cursor)) {
        added += 1;
      }
    }
    return cursor;
  }
  return addCalendarDays(startDateStr.slice(0, 10), maxDays);
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateRoomDatePolicy(
  dateStr: string,
  policies: PolicySettings,
): ValidationResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, reason: '올바른 예약 날짜를 선택해 주세요.' };
  }

  const today = getTodayYMD();
  const maxDate = addCalendarDays(today, policies.booking_horizon_days || 30);

  if (dateStr < today) {
    return { valid: false, reason: '지난 날짜는 예약할 수 없습니다.' };
  }

  if (dateStr > maxDate) {
    return {
      valid: false,
      reason: `회의실은 신청일 기준 향후 ${policies.booking_horizon_days || 30}일 이내(${maxDate})까지만 예약할 수 있습니다.`,
    };
  }

  if (isWeekend(dateStr)) {
    const dayName = parseYMD(dateStr).getDay() === 6 ? '토요일' : '일요일';
    return {
      valid: false,
      reason: `${formatKoreanDate(dateStr)}은 ${dayName}로 회의실을 예약할 수 없습니다. (월~금 운영)`,
    };
  }

  const holidayName = getKoreanHolidayName(dateStr);
  if (holidayName) {
    return {
      valid: false,
      reason: `${formatKoreanDate(dateStr)}은 대한민국 공휴일(${holidayName})로 예약할 수 없습니다.`,
    };
  }

  return { valid: true };
}

export function validateRoomBookingPolicy(
  dateStr: string,
  startHour: number,
  endHour: number,
  policies: PolicySettings,
): ValidationResult {
  const dateCheck = validateRoomDatePolicy(dateStr, policies);
  if (!dateCheck.valid) return dateCheck;

  if (!Number.isInteger(startHour) || !Number.isInteger(endHour)) {
    return { valid: false, reason: '예약 시간은 1시간 단위로만 선택할 수 있습니다.' };
  }

  if (startHour < OPERATING_START_HOUR || endHour > OPERATING_END_HOUR) {
    return {
      valid: false,
      reason: '회의실 운영 시간은 09:00~18:00입니다. 운영 시간 내에서 선택해 주세요.',
    };
  }

  if (endHour <= startHour) {
    return { valid: false, reason: '종료 시간은 시작 시간보다 최소 1시간 뒤여야 합니다.' };
  }

  const duration = endHour - startHour;
  const maxHours = policies.max_room_hours || 4;
  if (duration > maxHours) {
    return {
      valid: false,
      reason: `1회 최대 연속 예약 시간은 ${maxHours}시간입니다. (현재 ${duration}시간 선택됨)`,
    };
  }

  const now = new Date();
  if (dateStr === formatDateYMD(now)) {
    const startDateTime = parseYMD(dateStr);
    startDateTime.setHours(startHour, 0, 0, 0);
    if (startDateTime.getTime() <= now.getTime()) {
      return {
        valid: false,
        reason: '이미 시작되었거나 지난 시간대는 예약할 수 없습니다.',
      };
    }
  }

  return { valid: true };
}

export function validateReservationCancellation(
  reservation: RoomReservation,
  policies: PolicySettings,
  isAdmin: boolean,
): ValidationResult {
  if (reservation.status !== 'confirmed') {
    return { valid: false, reason: '이미 취소된 예약입니다.' };
  }
  if (isAdmin) {
    return { valid: true };
  }
  const startDt = parseYMD(reservation.date);
  startDt.setHours(reservation.start_hour, 0, 0, 0);
  const deadlineMs = (policies.cancel_deadline_minutes || 0) * 60 * 1000;
  const cutoff = startDt.getTime() - deadlineMs;

  if (Date.now() > cutoff) {
    if (policies.cancel_deadline_minutes > 0) {
      return {
        valid: false,
        reason: `예약 시작 ${policies.cancel_deadline_minutes}분 전까지만 직접 취소할 수 있습니다.`,
      };
    }
    return { valid: false, reason: '이미 시작되었거나 종료된 예약은 취소할 수 없습니다.' };
  }
  return { valid: true };
}

export function validateEquipmentLoanPolicy(
  startDate: string,
  dueDate: string,
  policies: PolicySettings,
): ValidationResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { valid: false, reason: '대여 시작일과 반납 예정일을 모두 선택해 주세요.' };
  }

  const today = getTodayYMD();
  if (startDate < today) {
    return { valid: false, reason: '대여 시작일은 오늘 이후 날짜만 선택할 수 있습니다.' };
  }

  if (dueDate < startDate) {
    return { valid: false, reason: '반납 예정일은 대여 시작일보다 빠를 수 없습니다.' };
  }

  const maxDays = policies.max_loan_days || 3;
  if (policies.loan_day_calc_mode === 'business') {
    const bizDays = countBusinessDaysBetween(startDate, dueDate);
    if (bizDays > maxDays) {
      return {
        valid: false,
        reason: `영업일 기준 최대 ${maxDays}일까지만 대여할 수 있습니다. (현재 ${bizDays}영업일)`,
      };
    }
  } else {
    const calDays = diffCalendarDays(startDate, dueDate);
    if (calDays > maxDays) {
      return {
        valid: false,
        reason: `달력일 기준 최대 ${maxDays}일까지만 대여할 수 있습니다. (현재 ${calDays}일)`,
      };
    }
  }

  return { valid: true };
}

export function buildSlotId(roomId: string, dateStr: string, hour: number): string {
  return `${roomId}_${dateStr}_${String(hour).padStart(2, '0')}`;
}

export function getEquipmentTypeLabel(type: 'laptop' | 'tablet' | 'camera'): string {
  switch (type) {
    case 'laptop':
      return '노트북';
    case 'tablet':
      return '태블릿';
    case 'camera':
      return '카메라';
  }
}

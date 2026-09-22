/**
 * DCW attendance rules — the single place that decides what a day is worth.
 *
 * Reporting time is 10:30. Till 10:45 is grace (paid in full), 10:46–11:30 is
 * late (a configured per-occurrence deduction), 11:31–12:30 is half day and
 * anything later is absent. None of those times are hard-coded: they live in
 * the hrms_settings row so admin can change them later (requirement doc §4, §7, §31).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface HrmsSettings {
  working_days: number
  weekly_off_day: number          // 0 = Sunday, JS getDay()
  office_start: string            // 'HH:MM'
  office_end: string
  grace_till: string
  late_till: string
  half_day_till: string
  early_leaving_grace_min: number
  min_full_day_minutes: number
  cl_per_month: number
  sl_per_month: number
  leave_carry_forward: boolean
  max_carry_forward: number | null
  salary_divisor: number
  half_day_factor: number
  late_deduction_amount: number
  salary_advance_enabled: boolean
}

/** Used until the settings row is read (and if the table isn't there yet). */
export const DEFAULT_SETTINGS: HrmsSettings = {
  working_days: 26,
  weekly_off_day: 0,
  office_start: '10:30',
  office_end: '18:00',
  grace_till: '10:45',
  late_till: '11:30',
  half_day_till: '12:30',
  early_leaving_grace_min: 0,
  min_full_day_minutes: 360,
  cl_per_month: 1,
  sl_per_month: 1,
  leave_carry_forward: true,
  max_carry_forward: null,
  salary_divisor: 26,
  half_day_factor: 0.5,
  late_deduction_amount: 0,
  salary_advance_enabled: true,
}

export type AttendanceStatus =
  | 'present' | 'late' | 'half_day' | 'absent' | 'missing'
  | 'weekly_off' | 'weekly_off_worked' | 'holiday' | 'holiday_worked'
  | 'leave' | 'cl' | 'sl' | 'lwp'

/** 'HH:MM' or 'HH:MM:SS' → minutes since midnight. */
export function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

export interface DayInput {
  /** 'yyyy-MM-dd' (IST calendar day) */
  date: string
  clockIn: string | null
  clockOut: string | null
  /** Admin-marked holiday for this date */
  isHoliday?: boolean
  /** An approved leave wins over the punch verdict (Phase 2 fills this) */
  leaveStatus?: 'leave' | 'cl' | 'sl' | 'lwp' | null
}

export interface DayVerdict {
  status: AttendanceStatus
  /** Minutes between first and last punch; null when the day has no pair. */
  workMinutes: number | null
  /** Minutes past office_start; 0 when on time. */
  lateMinutes: number
  /** Minutes left before office_end (beyond the allowed grace); 0 otherwise. */
  earlyMinutes: number
}

function isWeeklyOff(date: string, settings: HrmsSettings): boolean {
  // Parsed at noon so a timezone shift can never roll the day over
  const day = new Date(`${date}T12:00:00`).getDay()
  return day === settings.weekly_off_day
}

/**
 * Decide one employee-day. Pure: give it the punch times and the settings and
 * it returns the same verdict every time, which is what makes payroll auditable.
 */
export function evaluateDay(input: DayInput, settings: HrmsSettings = DEFAULT_SETTINGS): DayVerdict {
  const inMin = toMinutes(input.clockIn)
  const outMin = toMinutes(input.clockOut)
  const punched = inMin !== null

  const workMinutes = inMin !== null && outMin !== null ? Math.max(0, outMin - inMin) : null

  const startMin = toMinutes(settings.office_start) ?? 0
  const endMin = toMinutes(settings.office_end) ?? 0
  const lateMinutes = inMin !== null ? Math.max(0, inMin - startMin) : 0
  const earlyMinutes =
    outMin !== null ? Math.max(0, endMin - outMin - settings.early_leaving_grace_min) : 0

  const base = { workMinutes, lateMinutes, earlyMinutes }

  // Weekly off and holidays never cost salary; working on one is recorded (§14)
  if (isWeeklyOff(input.date, settings)) {
    return { ...base, status: punched ? 'weekly_off_worked' : 'weekly_off' }
  }
  if (input.isHoliday) {
    return { ...base, status: punched ? 'holiday_worked' : 'holiday' }
  }

  // An approved leave stands even if the person dropped in (§30 conflict case)
  if (input.leaveStatus) return { ...base, status: input.leaveStatus }

  if (!punched) return { ...base, status: 'absent' }

  // Punched in but never out (or vice versa) — a human has to fix this (§30)
  if (outMin === null) return { ...base, status: 'missing' }

  const graceTill = toMinutes(settings.grace_till) ?? startMin
  const lateTill = toMinutes(settings.late_till) ?? graceTill
  const halfDayTill = toMinutes(settings.half_day_till) ?? lateTill

  if (inMin! <= graceTill) return { ...base, status: 'present' }
  if (inMin! <= lateTill) return { ...base, status: 'late' }
  if (inMin! <= halfDayTill) return { ...base, status: 'half_day' }
  return { ...base, status: 'absent' }
}

/** What a day costs, as a fraction of one day's salary (§9). */
export function deductionFactor(status: AttendanceStatus, settings: HrmsSettings = DEFAULT_SETTINGS): number {
  if (status === 'half_day') return settings.half_day_factor
  if (status === 'absent' || status === 'lwp') return 1
  return 0
}

/** Reads the single settings row; falls back to defaults if it isn't there yet. */
export async function loadHrmsSettings(db: SupabaseClient<any, any, any>): Promise<HrmsSettings> {
  const { data, error } = await db.from('hrms_settings').select('*').eq('id', true).maybeSingle()
  if (error || !data) return DEFAULT_SETTINGS
  const row = data as Record<string, unknown>
  const num = (k: keyof HrmsSettings, d: number) => Number(row[k] ?? d)
  const time = (k: keyof HrmsSettings, d: string) => String(row[k] ?? d).slice(0, 5)
  return {
    working_days: num('working_days', 26),
    weekly_off_day: num('weekly_off_day', 0),
    office_start: time('office_start', '10:30'),
    office_end: time('office_end', '18:00'),
    grace_till: time('grace_till', '10:45'),
    late_till: time('late_till', '11:30'),
    half_day_till: time('half_day_till', '12:30'),
    early_leaving_grace_min: num('early_leaving_grace_min', 0),
    min_full_day_minutes: num('min_full_day_minutes', 360),
    cl_per_month: num('cl_per_month', 1),
    sl_per_month: num('sl_per_month', 1),
    leave_carry_forward: row.leave_carry_forward !== false,
    max_carry_forward: row.max_carry_forward == null ? null : Number(row.max_carry_forward),
    salary_divisor: num('salary_divisor', 26),
    half_day_factor: num('half_day_factor', 0.5),
    late_deduction_amount: num('late_deduction_amount', 0),
    salary_advance_enabled: row.salary_advance_enabled !== false,
  }
}

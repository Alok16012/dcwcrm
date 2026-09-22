/**
 * Leave maths for HRMS (requirement doc §11–§14).
 *
 * Balances are derived, never stored: monthly CL/SL credit from hrms_settings
 * runs from the employee's joining month to the month being viewed, minus the
 * days they actually took. Carry forward is simply "don't reset the running
 * total", with an optional cap on what crosses a month boundary.
 */

import { DEFAULT_SETTINGS, type HrmsSettings } from './attendance-rules'

export type LeaveKind = 'cl' | 'sl' | 'lwp'

/** Stored leave_type values map onto the three kinds payroll cares about. */
export function leaveKindOf(leaveType: string): LeaveKind {
  const t = (leaveType ?? '').toLowerCase()
  if (t === 'sick') return 'sl'
  if (t === 'casual' || t === 'earned') return 'cl'
  return 'lwp'   // 'unpaid', 'lwp', 'other'
}

/** The attendance status an approved leave day becomes. */
export const STATUS_FOR_KIND: Record<LeaveKind, 'cl' | 'sl' | 'lwp'> = { cl: 'cl', sl: 'sl', lwp: 'lwp' }

function isWeeklyOff(date: string, settings: HrmsSettings): boolean {
  return new Date(`${date}T12:00:00`).getDay() === settings.weekly_off_day
}

/**
 * The dates a leave actually consumes: weekly offs and holidays inside the
 * range are not charged to the employee's balance (§14).
 */
export function expandLeaveDays(
  from: string,
  to: string,
  settings: HrmsSettings = DEFAULT_SETTINGS,
  holidays: Set<string> = new Set(),
): string[] {
  const days: string[] = []
  const end = new Date(`${to}T12:00:00`)
  for (let d = new Date(`${from}T12:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    if (isWeeklyOff(iso, settings) || holidays.has(iso)) continue
    days.push(iso)
  }
  return days
}

/** Whole months from the joining month to the given month, inclusive. */
export function monthsCredited(joiningDate: string | null, year: number, month: number): number {
  if (!joiningDate) return 0
  const j = new Date(`${joiningDate}T12:00:00`)
  const months = (year - j.getFullYear()) * 12 + (month - (j.getMonth() + 1)) + 1
  return Math.max(0, months)
}

export interface LeaveBalance {
  /** Carried in from earlier months (after any cap) */
  opening: number
  /** Credited for the month being viewed */
  credit: number
  /** Taken in the month being viewed */
  used: number
  /** Taken in all earlier months */
  usedEarlier: number
  /** opening + credit - used */
  available: number
}

/**
 * Balance of one leave kind as at a given month.
 * `usedDates` is every approved day of that kind, ever (ISO dates).
 */
export function balanceFor(
  kind: Exclude<LeaveKind, 'lwp'>,
  opts: {
    joiningDate: string | null
    year: number
    month: number
    usedDates: string[]
    settings?: HrmsSettings
  },
): LeaveBalance {
  const s = opts.settings ?? DEFAULT_SETTINGS
  const perMonth = kind === 'cl' ? s.cl_per_month : s.sl_per_month
  const monthKey = `${opts.year}-${String(opts.month).padStart(2, '0')}`

  const used = opts.usedDates.filter(d => d.startsWith(monthKey)).length
  const usedEarlier = opts.usedDates.filter(d => d < monthKey).length

  const monthsTillNow = monthsCredited(opts.joiningDate, opts.year, opts.month)
  const creditedEarlier = Math.max(0, (monthsTillNow - 1)) * perMonth
  const credit = monthsTillNow > 0 ? perMonth : 0

  let opening = creditedEarlier - usedEarlier
  if (!s.leave_carry_forward) opening = 0                       // lapses each month
  if (opening < 0) opening = 0
  if (s.max_carry_forward != null) opening = Math.min(opening, s.max_carry_forward)

  return { opening, credit, used, usedEarlier, available: opening + credit - used }
}

/**
 * Split a leave request into paid days and LWP days: paid leave is used first,
 * anything beyond the balance falls to leave without pay (§13).
 */
export function splitPaidAndLwp(
  requestedDays: string[],
  available: number,
): { paid: string[]; lwp: string[] } {
  const paidCount = Math.max(0, Math.min(requestedDays.length, Math.floor(available)))
  return { paid: requestedDays.slice(0, paidCount), lwp: requestedDays.slice(paidCount) }
}

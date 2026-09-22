/**
 * Payroll from attendance (requirement doc §9, §18).
 *
 * Monthly salary ÷ salary divisor = one day's pay. Half days cost half of it,
 * absent and LWP days cost a full day, and every late arrival costs the
 * configured flat amount. Paid leave (CL/SL), weekly offs and holidays cost
 * nothing. Everything here is pure so a slip can be re-derived and checked.
 */

import { DEFAULT_SETTINGS, type HrmsSettings } from './attendance-rules'

export interface AttendanceCounts {
  present: number
  late: number
  half_day: number
  absent: number
  cl: number
  sl: number
  lwp: number
  weekly_off: number
  holiday: number
  missing: number
}

export const EMPTY_COUNTS: AttendanceCounts = {
  present: 0, late: 0, half_day: 0, absent: 0, cl: 0, sl: 0,
  lwp: 0, weekly_off: 0, holiday: 0, missing: 0,
}

/** Tally a month's attendance rows into the buckets payroll cares about. */
export function countAttendance(rows: { status: string }[]): AttendanceCounts {
  const c = { ...EMPTY_COUNTS }
  for (const r of rows) {
    switch (r.status) {
      case 'present': c.present++; break
      case 'late': c.late++; c.present++; break                 // late is still a working day
      case 'half_day': c.half_day++; break
      case 'absent': c.absent++; break
      case 'cl': c.cl++; break
      case 'sl': c.sl++; break
      case 'lwp': c.lwp++; break
      case 'weekly_off': case 'weekly_off_worked': c.weekly_off++; break
      case 'holiday': case 'holiday_worked': c.holiday++; break
      case 'leave': c.cl++; break                                // legacy rows
      case 'missing': c.missing++; break
    }
  }
  return c
}

export interface PayrollAdjustment { kind: 'addition' | 'deduction'; label: string; amount: number }

export interface PayrollInput {
  monthlySalary: number
  counts: AttendanceCounts
  /** Flat additions already on the employee record (HRA, allowances, incentive) */
  additions?: { hra?: number; allowances?: number; incentive?: number }
  /** Standing deductions (PF, TDS, other) */
  statutory?: { pf?: number; tds?: number; other?: number }
  advanceRecovery?: number
  adjustments?: PayrollAdjustment[]
  settings?: HrmsSettings
}

export interface PayrollBreakdown {
  perDaySalary: number
  lopDays: number
  lopDeduction: number
  lateDeduction: number
  adjustmentAdditions: number
  adjustmentDeductions: number
  gross: number
  totalDeductions: number
  net: number
}

/** Round to whole rupees — slips never show paise. */
const r = (n: number) => Math.round(n)

export function computePayroll(input: PayrollInput): PayrollBreakdown {
  const s = input.settings ?? DEFAULT_SETTINGS
  const divisor = s.salary_divisor > 0 ? s.salary_divisor : 26
  const perDaySalary = input.monthlySalary / divisor

  const c = input.counts
  // Days that actually cost salary: half days at the configured factor,
  // absents and leave-without-pay in full.
  const lopDays = c.half_day * s.half_day_factor + c.absent + c.lwp
  const lopDeduction = perDaySalary * lopDays
  const lateDeduction = c.late * s.late_deduction_amount

  const add = input.additions ?? {}
  const stat = input.statutory ?? {}
  const adjustmentAdditions = (input.adjustments ?? [])
    .filter(a => a.kind === 'addition').reduce((t, a) => t + a.amount, 0)
  const adjustmentDeductions = (input.adjustments ?? [])
    .filter(a => a.kind === 'deduction').reduce((t, a) => t + a.amount, 0)

  const gross = input.monthlySalary + (add.hra ?? 0) + (add.allowances ?? 0)
    + (add.incentive ?? 0) + adjustmentAdditions

  const totalDeductions = lopDeduction + lateDeduction
    + (stat.pf ?? 0) + (stat.tds ?? 0) + (stat.other ?? 0)
    + (input.advanceRecovery ?? 0) + adjustmentDeductions

  return {
    perDaySalary: r(perDaySalary),
    lopDays: Number(lopDays.toFixed(2)),
    lopDeduction: r(lopDeduction),
    lateDeduction: r(lateDeduction),
    adjustmentAdditions: r(adjustmentAdditions),
    adjustmentDeductions: r(adjustmentDeductions),
    gross: r(gross),
    totalDeductions: r(totalDeductions),
    net: r(gross - totalDeductions),
  }
}

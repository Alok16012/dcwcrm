/**
 * Berojgar Bharat payroll maths, in one place so the screen that previews a
 * salary and the route that writes it can never disagree.
 */

export interface SalaryStructure {
  basic_salary: number
  hra: number
  allowances: number
  pf_deduction: number
  tds_deduction: number
  other_deductions: number
  incentive_per_placement: number
  incentive_percent_of_commission: number
  salary_cycle_start_day: number
}

export interface AttendanceTally {
  present: number
  late: number
  half_day: number
  absent: number
  leave: number
  holiday: number
}

/** Standard working days a month is divided by when pricing a single day. */
const DAYS_IN_MONTH_FOR_RATE = 26

/**
 * The cycle a given month/year refers to.
 *
 * With a start day of 1 it is the calendar month. With, say, 17, "April" means
 * 17 March to 16 April — the cycle that gets *paid* in April.
 */
export function cycleDates(year: number, month: number, startDay: number): { start: Date; end: Date } {
  if (startDay === 1) {
    return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0) }
  }
  return { start: new Date(year, month - 2, startDay), end: new Date(year, month - 1, startDay - 1) }
}

export interface PayrollComputation {
  basic: number
  hra: number
  allowances: number
  presentDays: number
  absentDays: number
  halfDays: number
  leaveDays: number
  lopDays: number
  leaveDeduction: number
  placementCount: number
  placementIncentive: number
  gross: number
  pf: number
  tds: number
  otherDeductions: number
  net: number
}

export function computePayroll(
  s: SalaryStructure,
  attendance: AttendanceTally,
  placements: { commission: number }[]
): PayrollComputation {
  const basic = Number(s.basic_salary ?? 0)
  const hra = Number(s.hra ?? 0)
  const allowances = Number(s.allowances ?? 0)
  const monthly = basic + hra + allowances

  // Loss of pay: absent and leave cost a full day, a half day costs half.
  // Present, late and holiday are paid in full — being late is a discipline
  // matter, not a pay cut.
  const lopDays = attendance.absent + attendance.leave + attendance.half_day * 0.5
  const perDay = monthly / DAYS_IN_MONTH_FOR_RATE
  const leaveDeduction = Math.round(perDay * lopDays)

  // Recruitment pays on results: a flat amount per placement, a share of the
  // commission it earned, or both together.
  const placementCount = placements.length
  const commissionTotal = placements.reduce((sum, p) => sum + Number(p.commission ?? 0), 0)
  const placementIncentive = Math.round(
    placementCount * Number(s.incentive_per_placement ?? 0) +
      (commissionTotal * Number(s.incentive_percent_of_commission ?? 0)) / 100
  )

  const gross = monthly + placementIncentive
  const pf = Number(s.pf_deduction ?? 0)
  const tds = Number(s.tds_deduction ?? 0)
  const otherDeductions = Number(s.other_deductions ?? 0)
  const net = Math.round(gross - leaveDeduction - pf - tds - otherDeductions)

  return {
    basic, hra, allowances,
    presentDays: attendance.present + attendance.late,
    absentDays: attendance.absent,
    halfDays: attendance.half_day,
    leaveDays: attendance.leave,
    lopDays,
    leaveDeduction,
    placementCount,
    placementIncentive,
    gross,
    pf, tds, otherDeductions,
    net,
  }
}

export function tallyAttendance(rows: { status: string }[]): AttendanceTally {
  const t: AttendanceTally = { present: 0, late: 0, half_day: 0, absent: 0, leave: 0, holiday: 0 }
  for (const r of rows) {
    if (r.status in t) t[r.status as keyof AttendanceTally]++
  }
  return t
}

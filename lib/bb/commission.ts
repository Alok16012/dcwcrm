/**
 * What Berojgar Bharat earns from a placement, and when it gets billed.
 *
 * A deal lives on the company and may be overridden per job. At the moment a
 * candidate joins, whichever deal applied is *frozen onto the placement* — so
 * renegotiating a client's rate next quarter never moves revenue that is
 * already booked. Everything below therefore reads terms from the placement,
 * not from the company, once a placement exists.
 */

import { addDays, addMonths, format } from 'date-fns'

export type CommissionType = 'percent_of_salary' | 'fixed_per_hire'
export type CommissionBase = 'first_month' | 'monthly' | 'annual'
export type SalaryPeriod = 'monthly' | 'annual'

export interface CommissionTerms {
  type: CommissionType
  /** Percentage points, e.g. 8.5 — only for percent_of_salary. */
  percent: number | null
  /** What the percentage is taken of — only for percent_of_salary. */
  base: CommissionBase | null
  /** How many times it is billed. 1 for a one-time fee. */
  months: number
  /** Flat rupee amount per hire — only for fixed_per_hire. */
  fixedAmount: number | null
}

interface DealSource {
  commission_type?: string | null
  commission_percent?: number | string | null
  commission_base?: string | null
  commission_months?: number | string | null
  commission_fixed_amount?: number | string | null
}

function n(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * The deal that actually applies to a job.
 *
 * A job overrides the company only when it names its own commission_type —
 * a half-filled override (a percent with no type) is ignored rather than
 * silently mixed with the company's terms, because a blended deal nobody
 * agreed to is worse than falling back.
 */
export function resolveTerms(company: DealSource, job?: DealSource | null): CommissionTerms {
  const source = job?.commission_type ? job : company

  const type = (source.commission_type as CommissionType) ?? 'percent_of_salary'

  if (type === 'fixed_per_hire') {
    return {
      type,
      percent: null,
      base: null,
      months: 1,
      fixedAmount: n(source.commission_fixed_amount) ?? 0,
    }
  }

  const base = (source.commission_base as CommissionBase) ?? 'first_month'
  // A one-time cut of the first month's salary is billed once by definition;
  // only a recurring monthly cut repeats.
  const months = base === 'monthly' ? Math.max(1, n(source.commission_months) ?? 1) : 1

  return {
    type,
    percent: n(source.commission_percent) ?? 0,
    base,
    months,
    fixedAmount: null,
  }
}

/** Monthly figure, whatever period the salary was quoted in. */
export function monthlySalary(amount: number, period: SalaryPeriod): number {
  return period === 'annual' ? amount / 12 : amount
}

export function annualSalary(amount: number, period: SalaryPeriod): number {
  return period === 'annual' ? amount : amount * 12
}

export interface Instalment {
  instalmentNo: number
  amount: number
  /** ISO date (yyyy-MM-dd). */
  dueDate: string
  periodStart: string | null
  periodEnd: string | null
}

export interface ScheduleInput {
  offeredSalary: number
  salaryPeriod: SalaryPeriod
  /** ISO date the candidate joined. */
  joinedOn: string
  /** Days after which an invoice falls due. */
  paymentTermsDays: number
}

/**
 * Turn a deal plus a joining into the invoices that should exist.
 *
 * Three real shapes fall out of this:
 *   fixed_per_hire            → one invoice for the flat fee
 *   percent of first month    → one invoice for a slice of one month's pay
 *   percent monthly × N       → N invoices, one per month the cut runs
 */
export function buildSchedule(terms: CommissionTerms, input: ScheduleInput): Instalment[] {
  const joined = new Date(`${input.joinedOn}T00:00:00`)
  const iso = (d: Date) => format(d, 'yyyy-MM-dd')
  const round = (v: number) => Math.round(v * 100) / 100

  if (terms.type === 'fixed_per_hire') {
    return [
      {
        instalmentNo: 1,
        amount: round(terms.fixedAmount ?? 0),
        dueDate: iso(addDays(joined, input.paymentTermsDays)),
        periodStart: null,
        periodEnd: null,
      },
    ]
  }

  const pct = (terms.percent ?? 0) / 100

  if (terms.base === 'annual') {
    return [
      {
        instalmentNo: 1,
        amount: round(annualSalary(input.offeredSalary, input.salaryPeriod) * pct),
        dueDate: iso(addDays(joined, input.paymentTermsDays)),
        periodStart: null,
        periodEnd: null,
      },
    ]
  }

  const perMonth = round(monthlySalary(input.offeredSalary, input.salaryPeriod) * pct)

  if (terms.base === 'first_month') {
    return [
      {
        instalmentNo: 1,
        amount: perMonth,
        dueDate: iso(addDays(joined, input.paymentTermsDays)),
        periodStart: iso(joined),
        periodEnd: iso(addMonths(joined, 1)),
      },
    ]
  }

  // Recurring monthly cut: one invoice per month worked, each falling due the
  // agreed number of days after that month ends.
  return Array.from({ length: terms.months }, (_, i) => {
    const periodStart = addMonths(joined, i)
    const periodEnd = addMonths(joined, i + 1)
    return {
      instalmentNo: i + 1,
      amount: perMonth,
      dueDate: iso(addDays(periodEnd, input.paymentTermsDays)),
      periodStart: iso(periodStart),
      periodEnd: iso(periodEnd),
    }
  })
}

export function scheduleTotal(instalments: Instalment[]): number {
  return Math.round(instalments.reduce((sum, i) => sum + i.amount, 0) * 100) / 100
}

/** Human summary of a deal, for company cards and placement rows. */
export function describeTerms(terms: CommissionTerms): string {
  if (terms.type === 'fixed_per_hire') {
    return `₹${(terms.fixedAmount ?? 0).toLocaleString('en-IN')} per hire`
  }
  const pct = terms.percent ?? 0
  if (terms.base === 'annual') return `${pct}% of annual CTC, one time`
  if (terms.base === 'first_month') return `${pct}% of first month salary, one time`
  return `${pct}% of monthly salary × ${terms.months} month${terms.months > 1 ? 's' : ''}`
}

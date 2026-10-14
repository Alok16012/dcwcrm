'use client'

import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths, subYears } from 'date-fns'

/**
 * A date-range filter with the ranges people actually ask for — "how many
 * admissions last month, in the last 3 months…" — plus a custom range.
 * The value is what to keep in state; `rangeBounds` turns it into dates.
 */

export type DateRangeValue = { preset: DatePreset; from?: string; to?: string }
export type DatePreset = '' | 'this_month' | 'last_month' | 'last_3' | 'last_6' | 'this_year' | 'last_year' | 'custom'

const PRESETS: [DatePreset, string][] = [
  ['', 'Any date'],
  ['this_month', 'This month'],
  ['last_month', 'Last month'],
  ['last_3', 'Last 3 months'],
  ['last_6', 'Last 6 months'],
  ['this_year', 'This year'],
  ['last_year', 'Last year'],
  ['custom', 'Custom range'],
]

export const NO_DATE_RANGE: DateRangeValue = { preset: '' }

const day = (d: Date) => format(d, 'yyyy-MM-dd')

/** yyyy-MM-dd bounds, both inclusive; either may be missing. */
export function rangeBounds(v: DateRangeValue | undefined, today = new Date()): { from?: string; to?: string } {
  switch (v?.preset) {
    case 'this_month': return { from: day(startOfMonth(today)), to: day(today) }
    case 'last_month': {
      const m = subMonths(today, 1)
      return { from: day(startOfMonth(m)), to: day(endOfMonth(m)) }
    }
    case 'last_3': return { from: day(subMonths(today, 3)), to: day(today) }
    case 'last_6': return { from: day(subMonths(today, 6)), to: day(today) }
    case 'this_year': return { from: day(startOfYear(today)), to: day(today) }
    case 'last_year': {
      const y = subYears(today, 1)
      return { from: day(startOfYear(y)), to: day(endOfYear(y)) }
    }
    case 'custom': return { from: v.from || undefined, to: v.to || undefined }
    default: return {}
  }
}

/** Whether a date or timestamp falls in the range (compared by calendar day). */
export function inDateRange(value: string | null | undefined, v: DateRangeValue | undefined): boolean {
  const { from, to } = rangeBounds(v)
  if (!from && !to) return true
  if (!value) return false
  const d = day(new Date(value))
  return (!from || d >= from) && (!to || d <= to)
}

export function DateRangeFilter({ label = 'Date', value, onChange, className = 'h-9 text-sm' }: {
  label?: string
  value: DateRangeValue
  onChange: (v: DateRangeValue) => void
  className?: string
}) {
  const { from, to } = rangeBounds(value)
  const shown = from || to
    ? `${from ? format(new Date(from), 'dd MMM yyyy') : '…'} – ${to ? format(new Date(to), 'dd MMM yyyy') : '…'}`
    : undefined
  const active = Boolean(value.preset)
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value.preset}
        title={shown}
        onChange={(e) => onChange({ preset: e.target.value as DatePreset, from: value.from, to: value.to })}
        className={`border rounded-lg px-2 bg-white min-w-36 ${active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'text-gray-600'} ${className}`}
      >
        {PRESETS.map(([k, name]) => <option key={k} value={k}>{k ? `${label}: ${name}` : `${label}: Any`}</option>)}
      </select>
      {value.preset === 'custom' && (
        <div className={`flex items-center gap-1 border rounded-lg px-2 bg-white ${className}`}>
          <input type="date" value={value.from ?? ''} max={value.to || undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
            className="bg-transparent text-xs focus:outline-none w-[115px]" />
          <span className="text-xs text-gray-400">–</span>
          <input type="date" value={value.to ?? ''} min={value.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
            className="bg-transparent text-xs focus:outline-none w-[115px]" />
        </div>
      )}
      {active && value.preset !== 'custom' && shown && (
        <span className="text-[11px] text-gray-400 whitespace-nowrap hidden md:inline">{shown}</span>
      )}
    </div>
  )
}

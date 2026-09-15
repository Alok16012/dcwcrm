'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowUpRight, ArrowDownRight, CalendarDays, BarChart3 } from 'lucide-react'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
/** Short axis ticks: ₹3.8L, ₹37K */
const fmtShort = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${Math.round(n / 1e3)}K` : `₹${n}`

// Categorical slots 1–2 of the dataviz reference palette (validated: CVD ΔE 24.7, contrast ≥ 3:1)
const INCOME_COLOR = '#2a78d6'
const EXPENSE_COLOR = '#eb6834'
const MONTHS_IN_CHART = 6

type Row = { amount: number; date: string }

const sumWhere = (rows: Row[], pred: (d: string) => boolean) =>
  rows.reduce((s, r) => (pred(r.date) ? s + r.amount : s), 0)

/** Today's date as yyyy-MM-dd in IST, regardless of the browser/server timezone. */
const todayIst = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)

export function MonthlyFinanceSummary() {
  const now = new Date()
  const [view, setView] = useState<'monthly' | 'daily'>('monthly')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [day, setDay] = useState(todayIst())
  const [showTable, setShowTable] = useState(false)
  const [payments, setPayments] = useState<Row[]>([])
  const [expenses, setExpenses] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // One fetch covers the selected month, its day-wise breakdown and the 6-month comparison
  useEffect(() => {
    async function load() {
      setLoading(true)
      const selected = new Date(year, month - 1, 1)
      const start = format(startOfMonth(subMonths(selected, MONTHS_IN_CHART - 1)), 'yyyy-MM-dd')
      const end = format(endOfMonth(selected), 'yyyy-MM-dd')

      const [incRes, expRes] = await Promise.all([
        supabase.from('payments').select('amount, payment_date').gte('payment_date', start).lte('payment_date', end),
        supabase.from('expenses').select('amount, expense_date').neq('status', 'rejected').gte('expense_date', start).lte('expense_date', end),
      ])

      setPayments(((incRes.data ?? []) as { amount: number; payment_date: string }[])
        .map(r => ({ amount: Number(r.amount ?? 0), date: String(r.payment_date).slice(0, 10) })))
      setExpenses(((expRes.data ?? []) as { amount: number; expense_date: string }[])
        .map(r => ({ amount: Number(r.amount ?? 0), date: String(r.expense_date).slice(0, 10) })))
      setLoading(false)
    }
    load()
  }, [month, year])

  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  const income = sumWhere(payments, d => d.startsWith(monthKey))
  const expense = sumWhere(expenses, d => d.startsWith(monthKey))
  const profit = income - expense

  // Last 6 months ending on the selected month
  const chartData = useMemo(() => {
    const selected = new Date(year, month - 1, 1)
    return Array.from({ length: MONTHS_IN_CHART }, (_, i) => {
      const d = subMonths(selected, MONTHS_IN_CHART - 1 - i)
      const key = format(d, 'yyyy-MM')
      return {
        label: format(d, 'MMM yy'),
        Income: sumWhere(payments, x => x.startsWith(key)),
        Expense: sumWhere(expenses, x => x.startsWith(key)),
      }
    })
  }, [payments, expenses, month, year])

  const prev = chartData[chartData.length - 2]
  const pct = (cur: number, before: number) => (before > 0 ? Math.round(((cur - before) / before) * 100) : null)
  const incomeChange = prev ? pct(income, prev.Income) : null
  const expenseChange = prev ? pct(expense, prev.Expense) : null

  // Day-wise: every day of the selected month
  const dailyRows = useMemo(() => {
    const d = new Date(year, month - 1, 1)
    const last = new Date(year, month, 0)
    const cap = monthKey === todayIst().slice(0, 7) ? new Date(todayIst() + 'T00:00:00') : last
    return eachDayOfInterval({ start: d, end: cap < d ? d : cap }).map(date => {
      const key = format(date, 'yyyy-MM-dd')
      const inc = sumWhere(payments, x => x === key)
      const exp = sumWhere(expenses, x => x === key)
      return { key, label: format(date, 'dd MMM, EEE'), income: inc, expense: exp, net: inc - exp }
    }).reverse()
  }, [payments, expenses, month, year, monthKey])

  const dayIncome = sumWhere(payments, x => x === day)
  const dayExpense = sumWhere(expenses, x => x === day)

  function pickDay(value: string) {
    if (!value) return
    setDay(value)
    const [y, m] = value.split('-').map(Number)
    if (y !== year) setYear(y)
    if (m !== month) setMonth(m)
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="font-semibold text-sm text-gray-700">Overview</h3>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {([['monthly', 'Monthly', BarChart3], ['daily', 'Day-wise', CalendarDays]] as const).map(([key, label, Icon]) => (
            <button key={key} type="button" onClick={() => setView(key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === key ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
        {view === 'daily' && (
          <input type="date" value={day} max={todayIst()} onChange={e => pickDay(e.target.value)}
            className="h-8 border rounded-md px-2 text-sm bg-white" aria-label="Select date" />
        )}
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue>{MONTH_NAMES[month - 1]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-24 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {view === 'monthly' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryTile label="Income" value={loading ? '…' : fmt(income)} tone="green" change={loading ? null : incomeChange} goodWhenUp />
            <SummaryTile label="Expenses" value={loading ? '…' : fmt(expense)} tone="red" change={loading ? null : expenseChange} goodWhenUp={false} />
            <SummaryTile label={`Net ${profit >= 0 ? 'Profit' : 'Loss'}`} value={loading ? '…' : fmt(Math.abs(profit))} tone={profit >= 0 ? 'blue' : 'orange'} />
          </div>

          {/* Income vs Expense — last 6 months */}
          <div className="rounded-lg border bg-white p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <p className="text-sm font-semibold text-gray-800">Income vs Expense — last {MONTHS_IN_CHART} months</p>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <LegendItem color={INCOME_COLOR} label="Income" />
                <LegendItem color={EXPENSE_COLOR} label="Expense" />
                <button type="button" onClick={() => setShowTable(s => !s)} className="text-blue-600 hover:underline">
                  {showTable ? 'Hide table' : 'View as table'}
                </button>
              </div>
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-sm text-gray-400">Loading…</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e1e0d9" />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#c3c2b7' }} tick={{ fontSize: 11, fill: '#898781' }} />
                    <YAxis tickFormatter={fmtShort} tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: '#898781' }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(11,11,11,0.04)' }}
                      formatter={(v, name) => [fmt(Number(v)), String(name)]}
                      contentStyle={{ borderRadius: 8, border: '1px solid rgba(11,11,11,0.10)', fontSize: 12 }}
                      labelStyle={{ color: '#0b0b0b', fontWeight: 600 }}
                    />
                    <Bar dataKey="Income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="Expense" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {showTable && !loading && (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-xs">
                  <thead className="text-gray-500 border-b">
                    <tr><th className="text-left py-1.5">Month</th><th className="text-right py-1.5">Income</th><th className="text-right py-1.5">Expense</th><th className="text-right py-1.5">Net</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {chartData.map(r => (
                      <tr key={r.label}>
                        <td className="py-1.5">{r.label}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmt(r.Income)}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmt(r.Expense)}</td>
                        <td className={`py-1.5 text-right tabular-nums font-medium ${r.Income - r.Expense >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(r.Income - r.Expense)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryTile label={`Income · ${format(new Date(day + 'T00:00:00'), 'dd MMM yyyy')}`} value={loading ? '…' : fmt(dayIncome)} tone="green" />
            <SummaryTile label="Expenses" value={loading ? '…' : fmt(dayExpense)} tone="red" />
            <SummaryTile label={`Net ${dayIncome - dayExpense >= 0 ? 'Profit' : 'Loss'}`} value={loading ? '…' : fmt(Math.abs(dayIncome - dayExpense))} tone={dayIncome - dayExpense >= 0 ? 'blue' : 'orange'} />
          </div>

          <div className="rounded-lg border bg-white overflow-hidden">
            <p className="text-sm font-semibold text-gray-800 px-3 py-2 border-b">
              Day-wise — {MONTH_NAMES[month - 1]} {year}
            </p>
            <div className="max-h-80 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Date</th>
                    <th className="text-right px-3 py-2 font-semibold">Income</th>
                    <th className="text-right px-3 py-2 font-semibold">Expense</th>
                    <th className="text-right px-3 py-2 font-semibold">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">Loading…</td></tr>
                  ) : dailyRows.map(r => (
                    <tr key={r.key} onClick={() => setDay(r.key)}
                      className={`cursor-pointer ${r.key === day ? 'bg-blue-50' : 'hover:bg-slate-50'} ${r.income === 0 && r.expense === 0 ? 'text-gray-400' : ''}`}>
                      <td className="px-3 py-2 whitespace-nowrap">{r.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.income ? fmt(r.income) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.expense ? fmt(r.expense) : '—'}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.net > 0 ? 'text-green-700' : r.net < 0 ? 'text-red-700' : ''}`}>
                        {r.net ? fmt(r.net) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {!loading && (
                  <tfoot className="bg-slate-50 text-xs font-semibold sticky bottom-0">
                    <tr>
                      <td className="px-3 py-2">Month total</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(income)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(expense)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(profit)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const TONES = {
  green: 'bg-green-50 border-green-100 [&_.l]:text-green-700 [&_.v]:text-green-900',
  red: 'bg-red-50 border-red-100 [&_.l]:text-red-700 [&_.v]:text-red-900',
  blue: 'bg-blue-50 border-blue-100 [&_.l]:text-blue-700 [&_.v]:text-blue-900',
  orange: 'bg-orange-50 border-orange-100 [&_.l]:text-orange-700 [&_.v]:text-orange-900',
}

function SummaryTile({ label, value, tone, change, goodWhenUp }: {
  label: string; value: string; tone: keyof typeof TONES; change?: number | null; goodWhenUp?: boolean
}) {
  const up = (change ?? 0) >= 0
  const good = goodWhenUp === undefined ? null : up === goodWhenUp
  return (
    <div className={`rounded-lg border p-3 ${TONES[tone]}`}>
      <p className="l text-xs font-medium">{label}</p>
      <p className="v text-xl font-bold">{value}</p>
      {change !== undefined && change !== null && (
        <p className={`mt-0.5 flex items-center gap-0.5 text-[11px] font-medium ${good ? 'text-green-700' : 'text-red-700'}`}>
          {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(change)}% vs last month
        </p>
      )}
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

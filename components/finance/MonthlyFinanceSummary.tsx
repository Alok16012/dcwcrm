'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, startOfMonth, endOfMonth } from 'date-fns'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export function MonthlyFinanceSummary() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [income, setIncome] = useState(0)
  const [expense, setExpense] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const d = new Date(year, month - 1, 1)
      const start = format(startOfMonth(d), 'yyyy-MM-dd')
      const end = format(endOfMonth(d), 'yyyy-MM-dd')

      const [incRes, expRes] = await Promise.all([
        supabase.from('payments').select('amount').gte('payment_date', start).lte('payment_date', end),
        supabase.from('expenses').select('amount').neq('status', 'rejected').gte('expense_date', start).lte('expense_date', end),
      ])

      setIncome(((incRes.data ?? []) as { amount: number }[]).reduce((s, r) => s + (r.amount ?? 0), 0))
      setExpense(((expRes.data ?? []) as { amount: number }[]).reduce((s, r) => s + (r.amount ?? 0), 0))
      setLoading(false)
    }
    load()
  }, [month, year])

  const profit = income - expense
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="font-semibold text-sm text-gray-700">Monthly Overview</h3>
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

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-green-50 border border-green-100 p-3">
          <p className="text-xs text-green-700 font-medium">Income</p>
          <p className="text-xl font-bold text-green-900">{loading ? '…' : fmt(income)}</p>
        </div>
        <div className="rounded-lg bg-red-50 border border-red-100 p-3">
          <p className="text-xs text-red-700 font-medium">Expenses</p>
          <p className="text-xl font-bold text-red-900">{loading ? '…' : fmt(expense)}</p>
        </div>
        <div className={`rounded-lg border p-3 ${profit >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
          <p className={`text-xs font-medium ${profit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            Net {profit >= 0 ? 'Profit' : 'Loss'}
          </p>
          <p className={`text-xl font-bold ${profit >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
            {loading ? '…' : fmt(Math.abs(profit))}
          </p>
        </div>
      </div>
    </div>
  )
}

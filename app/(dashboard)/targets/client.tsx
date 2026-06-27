'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  IndianRupee,
  Medal,
  Plus,
  Search,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type Role = 'admin' | 'lead' | 'counselor' | 'backend' | string

interface Profile {
  id: string
  full_name: string
  role: Role
}

interface RevenueTarget {
  id: string
  assignee_id: string
  title: string
  target_amount: number
  lead_target: number
  conversion_target: number
  period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom'
  start_date: string
  end_date: string
  bonus_percentage: number
  notes: string | null
  status: 'active' | 'archived'
  created_at: string
  assignee?: Profile | Profile[] | null
}

interface PaymentRow {
  id: string
  amount: number
  payment_date: string
  lead?: { assigned_to: string | null; full_name: string | null } | { assigned_to: string | null; full_name: string | null }[] | null
  student?: { assigned_counsellor: string | null; full_name: string | null } | { assigned_counsellor: string | null; full_name: string | null }[] | null
}

interface LeadRow {
  id: string
  assigned_to: string | null
  status: string
  full_name: string
  created_at: string
  assigned_at: string | null
  converted_at: string | null
}

interface Props {
  currentUserId: string
  role: Role
  counselors: Profile[]
  initialTargets: RevenueTarget[]
  targetSetupError?: string | null
  payments: PaymentRow[]
  leads: LeadRow[]
  defaultStart: string
  defaultEnd: string
}

type PerformanceRow = {
  counselor: Profile
  targets: RevenueTarget[]
  targetAmount: number
  leadTarget: number
  conversionTarget: number
  achievedRevenue: number
  leadCount: number
  conversionCount: number
  pending: number
  achievement: number
  bonus: number
  level: Level
}

type Level = {
  name: string
  title: string
  min: number
  max: number | null
  bonus: number
  color: string
  bg: string
}

const LEVELS: Level[] = [
  { name: 'Level 1', title: 'Performer', min: 0, max: 60, bonus: 0, color: 'text-slate-700', bg: 'bg-slate-100' },
  { name: 'Level 2', title: 'Achiever', min: 61, max: 80, bonus: 2, color: 'text-sky-700', bg: 'bg-sky-100' },
  { name: 'Level 3', title: 'Star Performer', min: 81, max: 100, bonus: 5, color: 'text-emerald-700', bg: 'bg-emerald-100' },
  { name: 'Level 4', title: 'Champion', min: 101, max: 120, bonus: 8, color: 'text-violet-700', bg: 'bg-violet-100' },
  { name: 'Level 5', title: 'Legend', min: 121, max: null, bonus: 12, color: 'text-amber-700', bg: 'bg-amber-100' },
]

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(n || 0))

const pct = (value: number, total: number) => total > 0 ? Math.round((value / total) * 1000) / 10 : 0

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function getLevel(achievement: number) {
  return LEVELS.find(level => achievement >= level.min && (level.max == null || achievement <= level.max)) ?? LEVELS[0]
}

function inRange(dateValue: string | null | undefined, start: string, end: string) {
  if (!dateValue) return false
  const d = dateValue.slice(0, 10)
  return d >= start && d <= end
}

function getPaymentCounselorId(payment: PaymentRow) {
  const student = one(payment.student)
  const lead = one(payment.lead)
  return student?.assigned_counsellor || lead?.assigned_to || null
}

function targetAssignee(target: RevenueTarget) {
  return one(target.assignee)
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function TargetsClient({
  currentUserId,
  role,
  counselors,
  initialTargets,
  targetSetupError = null,
  payments,
  leads,
  defaultStart,
  defaultEnd,
}: Props) {
  const router = useRouter()
  const isAdmin = role === 'admin'
  const [targets, setTargets] = useState(initialTargets)
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [counselorFilter, setCounselorFilter] = useState(isAdmin ? 'all' : currentUserId)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [busy, startTransition] = useTransition()
  const [form, setForm] = useState({
    assignee_id: counselors[0]?.id ?? '',
    title: 'Monthly Revenue Target',
    target_amount: '',
    lead_target: '',
    conversion_target: '',
    period_type: 'monthly',
    start_date: defaultStart,
    end_date: defaultEnd,
    bonus_percentage: '0',
    notes: '',
  })

  const activeTargets = useMemo(() => targets.filter(t => {
    if (t.status !== 'active') return false
    if (t.end_date < startDate || t.start_date > endDate) return false
    if (counselorFilter !== 'all' && t.assignee_id !== counselorFilter) return false
    const assignee = targetAssignee(t)
    if (search && !assignee?.full_name.toLowerCase().includes(search.toLowerCase()) && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [targets, startDate, endDate, counselorFilter, search])

  const visibleCounselors = useMemo(() => counselors.filter(c => {
    if (!isAdmin && c.id !== currentUserId) return false
    if (counselorFilter !== 'all' && c.id !== counselorFilter) return false
    if (search && !c.full_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [counselors, isAdmin, currentUserId, counselorFilter, search])

  const rows = useMemo<PerformanceRow[]>(() => visibleCounselors.map(counselor => {
    const myTargets = activeTargets.filter(t => t.assignee_id === counselor.id)
    const targetAmount = myTargets.reduce((s, t) => s + Number(t.target_amount ?? 0), 0)
    const leadTarget = myTargets.reduce((s, t) => s + Number(t.lead_target ?? 0), 0)
    const conversionTarget = myTargets.reduce((s, t) => s + Number(t.conversion_target ?? 0), 0)
    const achievedRevenue = payments
      .filter(p => getPaymentCounselorId(p) === counselor.id && inRange(p.payment_date, startDate, endDate))
      .reduce((s, p) => s + Number(p.amount ?? 0), 0)
    const leadCount = leads.filter(l => l.assigned_to === counselor.id && inRange(l.assigned_at || l.created_at, startDate, endDate)).length
    const conversionCount = leads.filter(l => l.assigned_to === counselor.id && l.status === 'converted' && inRange(l.converted_at, startDate, endDate)).length
    const achievement = pct(achievedRevenue, targetAmount)
    const extraRevenue = Math.max(achievedRevenue - targetAmount, 0)
    const bonusRate = myTargets.length ? Math.max(...myTargets.map(t => Number(t.bonus_percentage ?? 0))) : getLevel(achievement).bonus
    return {
      counselor,
      targets: myTargets,
      targetAmount,
      leadTarget,
      conversionTarget,
      achievedRevenue,
      leadCount,
      conversionCount,
      pending: Math.max(targetAmount - achievedRevenue, 0),
      achievement,
      bonus: extraRevenue * (bonusRate / 100),
      level: getLevel(achievement),
    }
  }).sort((a, b) => b.achievement - a.achievement || b.achievedRevenue - a.achievedRevenue), [visibleCounselors, activeTargets, payments, leads, startDate, endDate])

  const totals = rows.reduce((acc, row) => {
    acc.target += row.targetAmount
    acc.revenue += row.achievedRevenue
    acc.pending += row.pending
    acc.bonus += row.bonus
    acc.leads += row.leadCount
    acc.conversions += row.conversionCount
    return acc
  }, { target: 0, revenue: 0, pending: 0, bonus: 0, leads: 0, conversions: 0 })
  const totalAchievement = pct(totals.revenue, totals.target)
  const topRow = rows[0]
  const myRow = rows.find(r => r.counselor.id === currentUserId) ?? rows[0]
  const recentPayments = payments
    .filter(p => {
      const counselorId = getPaymentCounselorId(p)
      const allowed = isAdmin ? (counselorFilter === 'all' || counselorId === counselorFilter) : counselorId === currentUserId
      return allowed && inRange(p.payment_date, startDate, endDate)
    })
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
    .slice(0, 8)

  function submitTarget() {
    if (!isAdmin) return
    if (!form.assignee_id) return toast.error('Counselor select karo')
    if (Number(form.target_amount || 0) <= 0 && Number(form.lead_target || 0) <= 0 && Number(form.conversion_target || 0) <= 0) {
      return toast.error('Kam se kam ek target value zaroori hai')
    }
    if (form.end_date < form.start_date) return toast.error('End date start date se pehle nahi ho sakta')

    startTransition(async () => {
      const payload = {
        assignee_id: form.assignee_id,
        title: form.title || 'Revenue Target',
        target_amount: Number(form.target_amount || 0),
        lead_target: Number(form.lead_target || 0),
        conversion_target: Number(form.conversion_target || 0),
        period_type: form.period_type,
        start_date: form.start_date,
        end_date: form.end_date,
        bonus_percentage: Number(form.bonus_percentage || 0),
        notes: form.notes || null,
        created_by: currentUserId,
      }
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Target save nahi hua')
        return
      }
      const assignee = counselors.find(c => c.id === form.assignee_id) ?? null
      setTargets(prev => [{ ...(json.target as RevenueTarget), assignee }, ...prev])
      setShowForm(false)
      toast.success('Target assigned')
      router.refresh()
    })
  }

  function archiveTarget(id: string) {
    if (!isAdmin) return
    startTransition(async () => {
      const res = await fetch('/api/targets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'archived' }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Target archive nahi hua')
        return
      }
      setTargets(prev => prev.map(t => t.id === id ? { ...t, status: 'archived' } : t))
      toast.success('Target archived')
    })
  }

  async function exportExcel() {
    const xlsx = await import('xlsx')
    const sheetRows = rows.map(row => ({
      Counselor: row.counselor.full_name,
      Target: row.targetAmount,
      Achieved: row.achievedRevenue,
      Pending: row.pending,
      Achievement: `${row.achievement}%`,
      Leads: row.leadCount,
      Conversions: row.conversionCount,
      Bonus: Math.round(row.bonus),
      Level: row.level.title,
    }))
    const ws = xlsx.utils.json_to_sheet(sheetRows)
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, 'Targets')
    xlsx.writeFile(wb, `revenue-targets-${startDate}-to-${endDate}.xlsx`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue & Target</h1>
          <p className="text-sm text-gray-500">{isAdmin ? 'Assign targets and monitor counselor performance' : 'My target, revenue achievement and bonus level'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button onClick={() => setShowForm(v => !v)} className="gap-2">
              <Plus className="w-4 h-4" /> Assign Target
            </Button>
          )}
          <Button variant="outline" onClick={exportExcel} className="gap-2" disabled={rows.length === 0}>
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>
      </div>

      {targetSetupError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-bold">Revenue target table setup pending</p>
          <p className="mt-0.5">Supabase me `088_revenue_targets.sql` migration run karna hai. Error: {targetSetupError}</p>
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search counselor or target" className="pl-9" />
          </div>
          {isAdmin && (
            <Select value={counselorFilter} onValueChange={setCounselorFilter}>
              <SelectTrigger className="min-w-[190px]">
                <SelectValue placeholder="Counselor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Counselors</SelectItem>
                {counselors.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>

      {showForm && isAdmin && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select value={form.assignee_id} onValueChange={v => setForm(f => ({ ...f, assignee_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Counselor" /></SelectTrigger>
              <SelectContent>
                {counselors.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Target title" />
            <Input type="number" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} placeholder="Revenue target amount" />
            <Input type="number" value={form.lead_target} onChange={e => setForm(f => ({ ...f, lead_target: e.target.value }))} placeholder="Lead target count" />
            <Input type="number" value={form.conversion_target} onChange={e => setForm(f => ({ ...f, conversion_target: e.target.value }))} placeholder="Conversion target count" />
            <Select value={form.period_type} onValueChange={v => setForm(f => ({ ...f, period_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            <Input type="number" value={form.bonus_percentage} onChange={e => setForm(f => ({ ...f, bonus_percentage: e.target.value }))} placeholder="Bonus % above target" />
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Remarks" className="md:col-span-2 xl:col-span-3 min-h-10" />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={submitTarget} disabled={busy}>Save Target</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Total Target', value: fmt(totals.target), icon: Target, tone: 'bg-blue-50 text-blue-700 border-blue-100' },
          { label: 'Revenue Achieved', value: fmt(totals.revenue), icon: IndianRupee, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
          { label: 'Pending', value: fmt(totals.pending), icon: CalendarDays, tone: 'bg-amber-50 text-amber-700 border-amber-100' },
          { label: 'Achievement', value: `${totalAchievement}%`, icon: TrendingUp, tone: 'bg-violet-50 text-violet-700 border-violet-100' },
          { label: 'Bonus Estimate', value: fmt(totals.bonus), icon: Trophy, tone: 'bg-rose-50 text-rose-700 border-rose-100' },
        ].map(card => (
          <div key={card.label} className={`rounded-2xl border p-4 ${card.tone}`}>
            <card.icon className="h-5 w-5 mb-2" />
            <p className="text-xs font-bold uppercase opacity-70">{card.label}</p>
            <p className="text-xl font-extrabold mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {!isAdmin && myRow && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase">My Target</p>
              <h2 className="mt-1 text-xl font-bold text-gray-900">{myRow.counselor.full_name}</h2>
              <p className="text-sm text-gray-500">{format(parseISO(startDate), 'dd MMM yyyy')} to {format(parseISO(endDate), 'dd MMM yyyy')}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${myRow.level.bg} ${myRow.level.color}`}>{myRow.level.title}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SmallMetric label="Assigned Target" value={fmt(myRow.targetAmount)} />
            <SmallMetric label="Achieved" value={fmt(myRow.achievedRevenue)} tone="green" />
            <SmallMetric label="Achievement" value={`${myRow.achievement}%`} tone="blue" />
            <SmallMetric label="Pending" value={fmt(myRow.pending)} tone="amber" />
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs font-semibold text-gray-500">
              <span>Progress Overview</span>
              <span>{fmt(myRow.achievedRevenue)} / {fmt(myRow.targetAmount)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(myRow.achievement, 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">Counselor Performance</h2>
            </div>
            <span className="text-xs font-semibold text-gray-500">{rows.length} counselor{rows.length !== 1 ? 's' : ''}</span>
          </div>
          {rows.length === 0 ? (
            <div className="py-14 text-center text-sm text-gray-400">No target data found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Counselor</th>
                    <th className="px-4 py-3 text-right">Target</th>
                    <th className="px-4 py-3 text-right">Achieved</th>
                    <th className="px-4 py-3 text-right">Pending</th>
                    <th className="px-4 py-3 text-center">Progress</th>
                    <th className="px-4 py-3 text-center">Leads</th>
                    <th className="px-4 py-3 text-center">Conversions</th>
                    <th className="px-4 py-3 text-right">Bonus</th>
                    <th className="px-4 py-3 text-center">Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map(row => (
                    <tr key={row.counselor.id} className="hover:bg-blue-50/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold text-white">{initials(row.counselor.full_name)}</div>
                          <div>
                            <p className="font-bold text-gray-900">{row.counselor.full_name}</p>
                            <p className="text-[11px] text-gray-400">{row.targets.length} active target{row.targets.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{fmt(row.targetAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmt(row.achievedRevenue)}</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-700">{fmt(row.pending)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(row.achievement, 100)}%` }} />
                          </div>
                          <span className="w-12 text-right text-xs font-bold text-blue-700">{row.achievement}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{row.leadCount}{row.leadTarget ? `/${row.leadTarget}` : ''}</td>
                      <td className="px-4 py-3 text-center font-semibold">{row.conversionCount}{row.conversionTarget ? `/${row.conversionTarget}` : ''}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-700">{fmt(row.bonus)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${row.level.bg} ${row.level.color}`}>{row.level.title}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-bold text-gray-900">Top Performer</h2>
            </div>
            {topRow ? (
              <div className="mt-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-sm font-bold text-white">{initials(topRow.counselor.full_name)}</div>
                  <div>
                    <p className="font-bold text-gray-900">{topRow.counselor.full_name}</p>
                    <p className="text-sm text-gray-500">{fmt(topRow.achievedRevenue)} achieved</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-amber-50 p-3 text-amber-800">
                  <p className="text-xs font-bold uppercase">Achievement</p>
                  <p className="text-2xl font-extrabold">{topRow.achievement}%</p>
                </div>
              </div>
            ) : <p className="mt-4 text-sm text-gray-400">No data</p>}
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">Levels & Bonus</h2>
            </div>
            <div className="mt-3 space-y-2">
              {LEVELS.map(level => (
                <div key={level.name} className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <div>
                    <p className="text-xs font-bold text-gray-900">{level.name} - {level.title}</p>
                    <p className="text-[11px] text-gray-400">{level.max == null ? `${level.min}%+` : `${level.min}% - ${level.max}%`} achievement</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${level.bg} ${level.color}`}>{level.bonus}% bonus</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">Active Targets</h2>
            </div>
            <span className="text-xs font-semibold text-gray-500">{activeTargets.length}</span>
          </div>
          <div className="divide-y">
            {activeTargets.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No active targets for selected range</div>
            ) : activeTargets.map(target => {
              const assignee = targetAssignee(target)
              return (
                <div key={target.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">{target.title}</p>
                      <p className="text-xs text-gray-500">{assignee?.full_name ?? 'Counselor'} · {format(parseISO(target.start_date), 'dd MMM')} to {format(parseISO(target.end_date), 'dd MMM yyyy')}</p>
                    </div>
                    {isAdmin && (
                      <button className="text-xs font-semibold text-red-500 hover:underline" onClick={() => archiveTarget(target.id)}>Archive</button>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <SmallMetric label="Revenue" value={fmt(Number(target.target_amount ?? 0))} />
                    <SmallMetric label="Leads" value={String(target.lead_target ?? 0)} tone="blue" />
                    <SmallMetric label="Conversions" value={String(target.conversion_target ?? 0)} tone="green" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-gray-900">Recent Revenue</h2>
            </div>
            <span className="text-xs font-semibold text-gray-500">{recentPayments.length}</span>
          </div>
          <div className="divide-y">
            {recentPayments.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No revenue in selected range</div>
            ) : recentPayments.map(payment => {
              const lead = one(payment.lead)
              const student = one(payment.student)
              return (
                <div key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{student?.full_name || lead?.full_name || 'Manual Income'}</p>
                    <p className="text-xs text-gray-400">{format(parseISO(payment.payment_date), 'dd MMM yyyy')}</p>
                  </div>
                  <p className="font-extrabold text-emerald-700">{fmt(Number(payment.amount ?? 0))}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function SmallMetric({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'green' | 'blue' | 'amber' }) {
  const cls = {
    slate: 'bg-slate-50 text-slate-800',
    green: 'bg-emerald-50 text-emerald-800',
    blue: 'bg-blue-50 text-blue-800',
    amber: 'bg-amber-50 text-amber-800',
  }[tone]
  return (
    <div className={`rounded-xl px-3 py-2 ${cls}`}>
      <p className="text-[10px] font-bold uppercase opacity-70">{label}</p>
      <p className="mt-1 text-sm font-extrabold">{value}</p>
    </div>
  )
}

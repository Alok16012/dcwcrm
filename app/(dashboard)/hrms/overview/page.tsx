import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadHrmsSettings } from '@/lib/hrms/attendance-rules'
import {
  Users, CheckCircle2, Clock, AlertTriangle, XCircle, CalendarDays,
  ClipboardCheck, Banknote, ArrowRight,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

/** Admin daily overview — requirement doc §23. */
export default async function HrmsOverviewPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user.id).single()) as { data: { role: string } | null }
  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  const db = supabase as unknown as { from: (t: string) => any }
  const today = istToday()
  const now = new Date()
  const month = now.getMonth() + 1, year = now.getFullYear()
  const settings = await loadHrmsSettings(supabase as never)

  const [
    { count: totalEmployees },
    { data: todayRows },
    { count: pendingLeave },
    { count: pendingRegularization },
    { data: payrollRows },
    { data: holidayToday },
  ] = await Promise.all([
    db.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
    db.from('attendance').select('status, late_minutes').eq('date', today),
    db.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('attendance_regularizations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('payroll').select('gross, net, status, is_locked').eq('month', month).eq('year', year),
    db.from('holidays').select('name').eq('holiday_date', today).eq('is_active', true).maybeSingle(),
  ])

  const rows = (todayRows ?? []) as { status: string; late_minutes: number | null }[]
  const count = (s: string[]) => rows.filter(r => s.includes(r.status)).length

  const present = count(['present', 'late', 'weekly_off_worked', 'holiday_worked'])
  const late = count(['late'])
  const halfDay = count(['half_day'])
  const absent = count(['absent'])
  const onLeave = count(['cl', 'sl', 'lwp', 'leave'])
  const weeklyOff = count(['weekly_off'])
  const missing = count(['missing'])
  const unmarked = Math.max(0, (totalEmployees ?? 0) - rows.length)

  const payroll = (payrollRows ?? []) as { gross: number | null; net: number | null; status: string; is_locked: boolean }[]
  const totalGross = payroll.reduce((t, p) => t + Number(p.gross ?? 0), 0)
  const totalNet = payroll.reduce((t, p) => t + Number(p.net ?? 0), 0)
  const pendingApproval = payroll.filter(p => p.status === 'draft').length
  const isWeeklyOffToday = new Date(`${today}T12:00:00`).getDay() === settings.weekly_off_day
  const holidayName = (holidayToday as { name: string } | null)?.name ?? null

  const stats = [
    { label: 'Employees', value: totalEmployees ?? 0, icon: Users, cls: 'bg-slate-50 border-slate-200 text-slate-700' },
    { label: 'Present', value: present, icon: CheckCircle2, cls: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Late', value: late, icon: Clock, cls: 'bg-orange-50 border-orange-200 text-orange-700' },
    { label: 'Half Day', value: halfDay, icon: AlertTriangle, cls: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { label: 'Absent', value: absent, icon: XCircle, cls: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'On Leave', value: onLeave, icon: CalendarDays, cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Weekly Off', value: weeklyOff, icon: CalendarDays, cls: 'bg-slate-50 border-slate-200 text-slate-500' },
    { label: 'Not Punched', value: unmarked + missing, icon: AlertTriangle, cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">HRMS Overview</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(`${today}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          {holidayName ? ` · Holiday: ${holidayName}` : isWeeklyOffToday ? ' · Weekly off' : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`border rounded-2xl p-4 ${s.cls}`}>
            <s.icon className="w-4 h-4 mb-2 opacity-70" />
            <p className="text-2xl font-extrabold leading-tight tabular-nums">{s.value}</p>
            <p className="text-[11px] font-semibold opacity-70 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <PendingCard href="/hrms/leave" icon={CalendarDays} label="Leave requests" count={pendingLeave ?? 0} />
        <PendingCard href="/hrms/regularization" icon={ClipboardCheck} label="Regularization requests" count={pendingRegularization ?? 0} />
        <PendingCard href="/hrms/payroll" icon={Banknote} label="Payroll awaiting approval" count={pendingApproval} />
      </div>

      <div className="bg-white border rounded-2xl p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-3">
          Payroll · {now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
        {payroll.length === 0 ? (
          <p className="text-sm text-gray-400">
            Is mahine ka payroll abhi generate nahi hua —{' '}
            <Link href="/hrms/payroll" className="text-blue-600 hover:underline">Payroll tab</Link> se banao.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Money label="Rows" value={String(payroll.length)} />
            <Money label="Total Gross" value={inr(totalGross)} />
            <Money label="Deductions" value={inr(totalGross - totalNet)} />
            <Money label="Net Payable" value={inr(totalNet)} strong />
          </div>
        )}
      </div>
    </div>
  )
}

function PendingCard({ href, icon: Icon, label, count }: { href: string; icon: any; label: string; count: number }) {
  return (
    <Link href={href} className={`border rounded-2xl p-4 flex items-center gap-3 transition-colors ${count > 0 ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' : 'bg-white hover:bg-slate-50'}`}>
      <div className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center shrink-0">
        <Icon className={`w-5 h-5 ${count > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xl font-extrabold tabular-nums">{count}</p>
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-300" />
    </Link>
  )
}

function Money({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="border rounded-xl px-3 py-2 bg-slate-50">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 tabular-nums ${strong ? 'text-lg font-extrabold text-green-700' : 'text-sm font-bold text-slate-700'}`}>{value}</p>
    </div>
  )
}

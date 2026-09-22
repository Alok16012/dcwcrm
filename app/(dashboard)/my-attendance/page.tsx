import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadHrmsSettings } from '@/lib/hrms/attendance-rules'
import { balanceFor } from '@/lib/hrms/leave'
import { countAttendance } from '@/lib/hrms/payroll'
import { ATTENDANCE_STATUS_LABELS } from '@/types/app.types'
import { Clock, CalendarDays, Banknote, LogIn, LogOut, Timer } from 'lucide-react'

export const dynamic = 'force-dynamic'

const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const hhmm = (t: string | null) => (t ? String(t).slice(0, 5) : '—')
const hours = (mins: number | null) => (mins == null ? '—' : `${Math.floor(mins / 60)}h ${mins % 60}m`)

const STATUS_CLS: Record<string, string> = {
  present: 'bg-green-100 text-green-800', late: 'bg-orange-100 text-orange-800',
  half_day: 'bg-yellow-100 text-yellow-800', absent: 'bg-red-100 text-red-700',
  weekly_off: 'bg-slate-100 text-slate-600', weekly_off_worked: 'bg-teal-100 text-teal-800',
  holiday: 'bg-slate-100 text-slate-600', holiday_worked: 'bg-teal-100 text-teal-800',
  missing: 'bg-amber-100 text-amber-800', cl: 'bg-blue-100 text-blue-800',
  sl: 'bg-violet-100 text-violet-800', lwp: 'bg-rose-100 text-rose-800',
}

/** What an employee sees about their own attendance, leave and salary (§22). */
export default async function MyAttendancePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as unknown as { from: (t: string) => any }
  const { data: employee } = await db
    .from('employees')
    .select('id, employee_code, designation, department, joining_date, basic_salary')
    .eq('profile_id', user.id).maybeSingle()

  if (!employee) {
    return (
      <div className="text-center py-20 border rounded-2xl bg-white max-w-lg mx-auto">
        <Clock className="w-10 h-10 mx-auto mb-3 text-gray-200" />
        <p className="font-semibold text-gray-600">Aapka employee record nahi mila</p>
        <p className="text-xs text-gray-400 mt-1">HR se bolo ki HRMS me aapko add kar de</p>
      </div>
    )
  }

  const settings = await loadHrmsSettings(supabase as never)
  const today = istToday()
  const now = new Date()
  const month = now.getMonth() + 1, year = now.getFullYear()
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`

  const [{ data: todayRow }, { data: monthRows }, { data: leaveDays }, { data: slips }] = await Promise.all([
    db.from('attendance').select('status, clock_in, clock_out, work_minutes, late_minutes, early_minutes')
      .eq('employee_id', employee.id).eq('date', today).maybeSingle(),
    db.from('attendance').select('date, status, clock_in, clock_out, work_minutes, late_minutes')
      .eq('employee_id', employee.id).gte('date', monthStart).lte('date', monthEnd).order('date', { ascending: false }),
    db.from('attendance').select('date, status').eq('employee_id', employee.id).in('status', ['cl', 'sl']),
    db.from('payroll').select('month, year, net, status, payment_date')
      .eq('employee_id', employee.id).order('year', { ascending: false }).order('month', { ascending: false }).limit(6),
  ])

  const rows = (monthRows ?? []) as { date: string; status: string; clock_in: string | null; clock_out: string | null; work_minutes: number | null; late_minutes: number | null }[]
  const counts = countAttendance(rows)
  const totalMinutes = rows.reduce((t, r) => t + (r.work_minutes ?? 0), 0)

  const used = { cl: [] as string[], sl: [] as string[] }
  for (const l of (leaveDays ?? []) as { date: string; status: 'cl' | 'sl' }[]) used[l.status].push(l.date)
  const cl = balanceFor('cl', { joiningDate: employee.joining_date, year, month, usedDates: used.cl, settings })
  const sl = balanceFor('sl', { joiningDate: employee.joining_date, year, month, usedDates: used.sl, settings })

  const t = todayRow as { status: string; clock_in: string | null; clock_out: string | null; work_minutes: number | null; late_minutes: number | null; early_minutes: number | null } | null

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">My Attendance</h1>
        <p className="text-sm text-muted-foreground">
          {employee.employee_code ?? '—'}{employee.designation ? ` · ${employee.designation}` : ''} ·{' '}
          {now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Today */}
      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Today</p>
          <span className={`text-[11px] font-bold uppercase px-2.5 py-1 rounded-full ${STATUS_CLS[t?.status ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
            {t ? (ATTENDANCE_STATUS_LABELS[t.status as keyof typeof ATTENDANCE_STATUS_LABELS] ?? t.status) : 'Not punched'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tile icon={LogIn} label="Punch In" value={hhmm(t?.clock_in ?? null)} />
          <Tile icon={LogOut} label="Punch Out" value={hhmm(t?.clock_out ?? null)} />
          <Tile icon={Timer} label="Working Hours" value={hours(t?.work_minutes ?? null)} />
          <Tile icon={Clock} label="Late By" value={t?.late_minutes ? `${t.late_minutes} min` : '—'} />
        </div>
      </div>

      {/* This month */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Mini label="Present" value={counts.present} cls="bg-green-50 text-green-700 border-green-200" />
        <Mini label="Late" value={counts.late} cls="bg-orange-50 text-orange-700 border-orange-200" />
        <Mini label="Half Day" value={counts.half_day} cls="bg-yellow-50 text-yellow-700 border-yellow-200" />
        <Mini label="Absent" value={counts.absent} cls="bg-red-50 text-red-700 border-red-200" />
        <Mini label="Leave" value={counts.cl + counts.sl} cls="bg-blue-50 text-blue-700 border-blue-200" />
        <Mini label="LWP" value={counts.lwp} cls="bg-rose-50 text-rose-700 border-rose-200" />
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Total working hours this month: <b>{hours(totalMinutes)}</b>
      </p>

      {/* Leave balance */}
      <div className="bg-white border rounded-2xl p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-3 flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" /> Leave Balance
        </p>
        <div className="grid grid-cols-2 gap-3">
          {([['Casual Leave', cl], ['Sick Leave', sl]] as const).map(([label, b]) => (
            <div key={label} className="border rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-600">{label}</p>
              <p className="text-2xl font-extrabold text-blue-700 tabular-nums mt-0.5">{b.available}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Carry forward {b.opening} + this month {b.credit} − used {b.used}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Salary slips */}
      <div className="bg-white border rounded-2xl overflow-hidden">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700 px-4 py-3 border-b flex items-center gap-1.5">
          <Banknote className="w-3.5 h-3.5" /> Salary
        </p>
        {(slips ?? []).length === 0 ? (
          <p className="text-sm text-gray-400 px-4 py-6">Abhi koi payroll record nahi hai</p>
        ) : (
          <div className="divide-y">
            {((slips ?? []) as { month: number; year: number; net: number | null; status: string; payment_date: string | null }[]).map(s => (
              <div key={`${s.year}-${s.month}`} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className="font-medium text-gray-800">
                  {new Date(s.year, s.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </span>
                <span className="ml-auto tabular-nums font-bold text-gray-900">{inr(Number(s.net ?? 0))}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  s.status === 'paid' ? 'bg-green-100 text-green-700'
                  : s.status === 'processed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Day-wise */}
      <div className="bg-white border rounded-2xl overflow-hidden">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700 px-4 py-3 border-b">This Month, Day-wise</p>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-center px-3 py-2">In</th>
                <th className="text-center px-3 py-2">Out</th>
                <th className="text-center px-3 py-2">Hours</th>
                <th className="text-center px-3 py-2">Late</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => (
                <tr key={r.date} className="hover:bg-slate-50">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(`${r.date}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' })}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_CLS[r.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {ATTENDANCE_STATUS_LABELS[r.status as keyof typeof ATTENDANCE_STATUS_LABELS] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{hhmm(r.clock_in)}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{hhmm(r.clock_out)}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{hours(r.work_minutes)}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-orange-600">{r.late_minutes ? `${r.late_minutes}m` : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Is mahine ka koi record nahi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Tile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="border rounded-xl p-3 bg-slate-50">
      <Icon className="w-4 h-4 text-slate-400 mb-1" />
      <p className="text-lg font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-[10px] font-semibold uppercase text-slate-400">{label}</p>
    </div>
  )
}

function Mini({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`border rounded-xl px-3 py-2 text-center ${cls}`}>
      <p className="text-lg font-extrabold tabular-nums">{value}</p>
      <p className="text-[10px] font-semibold opacity-80">{label}</p>
    </div>
  )
}

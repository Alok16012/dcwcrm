import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import HrmsReportsClient from '@/components/hrms/HrmsReportsClient'
import { loadHrmsSettings } from '@/lib/hrms/attendance-rules'
import { balanceFor } from '@/lib/hrms/leave'
import { countAttendance } from '@/lib/hrms/payroll'

export const dynamic = 'force-dynamic'

/** Attendance, leave and payroll reports for one month (requirement doc §26). */
export default async function HrmsReportsPage({
  searchParams,
}: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user.id).single()) as { data: { role: string } | null }
  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  const sp = await searchParams
  const now = new Date()
  const month = Number(sp.month ?? now.getMonth() + 1)
  const year = Number(sp.year ?? now.getFullYear())

  const db = supabase as unknown as { from: (t: string) => any }
  const settings = await loadHrmsSettings(supabase as never)

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`

  const [{ data: employees }, { data: attendance }, { data: payroll }, { data: allLeaveDays }] = await Promise.all([
    db.from('employees').select('id, profile_id, employee_code, department, designation, joining_date, basic_salary').eq('is_active', true),
    db.from('attendance').select('employee_id, date, status, work_minutes, late_minutes, early_minutes').gte('date', from).lte('date', to),
    db.from('payroll').select('*').eq('month', month).eq('year', year),
    db.from('attendance').select('employee_id, date, status').in('status', ['cl', 'sl']),
  ])

  const empRows = (employees ?? []) as Record<string, any>[]
  const { data: profiles } = empRows.length
    ? await supabase.from('profiles').select('id, full_name').in('id', empRows.map(e => e.profile_id))
    : { data: [] }
  const nameByProfile = Object.fromEntries(((profiles ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))

  const attByEmp = new Map<string, any[]>()
  for (const a of (attendance ?? []) as any[]) {
    if (!attByEmp.has(a.employee_id)) attByEmp.set(a.employee_id, [])
    attByEmp.get(a.employee_id)!.push(a)
  }
  const leaveByEmp = new Map<string, { cl: string[]; sl: string[] }>()
  for (const l of (allLeaveDays ?? []) as { employee_id: string; date: string; status: 'cl' | 'sl' }[]) {
    const e = leaveByEmp.get(l.employee_id) ?? { cl: [], sl: [] }
    e[l.status].push(l.date)
    leaveByEmp.set(l.employee_id, e)
  }
  const payrollByEmp = new Map<string, Record<string, any>>()
  for (const p of (payroll ?? []) as Record<string, any>[]) payrollByEmp.set(p.employee_id, p)

  const rows = empRows.map(e => {
    const att = attByEmp.get(e.id) ?? []
    const c = countAttendance(att)
    const used = leaveByEmp.get(e.id) ?? { cl: [], sl: [] }
    const pay = payrollByEmp.get(e.id)
    return {
      employee_id: e.id,
      name: nameByProfile[e.profile_id] ?? '—',
      employee_code: e.employee_code ?? '',
      department: e.department ?? '',
      designation: e.designation ?? '',
      present: c.present, late: c.late, half_day: c.half_day, absent: c.absent,
      cl: c.cl, sl: c.sl, lwp: c.lwp, weekly_off: c.weekly_off, holiday: c.holiday, missing: c.missing,
      work_minutes: att.reduce((t: number, a: any) => t + (a.work_minutes ?? 0), 0),
      late_minutes: att.reduce((t: number, a: any) => t + (a.late_minutes ?? 0), 0),
      early_minutes: att.reduce((t: number, a: any) => t + (a.early_minutes ?? 0), 0),
      cl_balance: balanceFor('cl', { joiningDate: e.joining_date, year, month, usedDates: used.cl, settings }).available,
      sl_balance: balanceFor('sl', { joiningDate: e.joining_date, year, month, usedDates: used.sl, settings }).available,
      salary: Number(e.basic_salary ?? 0),
      gross: Number(pay?.gross ?? 0),
      lop_deduction: Number(pay?.leave_deduction ?? 0),
      late_deduction: Number(pay?.late_deduction ?? 0),
      advance_deduction: Number(pay?.advance_deduction ?? 0),
      pf: Number(pay?.pf ?? 0), tds: Number(pay?.tds ?? 0),
      net: Number(pay?.net ?? 0),
      payroll_status: pay?.status ?? '—',
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  return <HrmsReportsClient rows={rows} month={month} year={year} workingDays={settings.working_days} />
}

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import LeaveClient from '@/components/hrms/LeaveClient'
import { loadHrmsSettings } from '@/lib/hrms/attendance-rules'
import { balanceFor } from '@/lib/hrms/leave'

export const dynamic = 'force-dynamic'

export default async function HrmsLeavePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user.id).single()) as { data: { role: string } | null }
  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  const db = supabase as unknown as { from: (t: string) => any }
  const settings = await loadHrmsSettings(supabase as never)

  const [{ data: employees }, { data: requests }, { data: holidays }, { data: leaveDays }] = await Promise.all([
    db.from('employees').select('id, profile_id, employee_code, joining_date').eq('is_active', true),
    db.from('leave_requests')
      .select('id, employee_id, leave_type, from_date, to_date, days, reason, status, rejection_reason, created_at')
      .order('created_at', { ascending: false }).limit(200),
    db.from('holidays').select('id, holiday_date, name, is_active').order('holiday_date', { ascending: false }),
    db.from('attendance').select('employee_id, date, status').in('status', ['cl', 'sl', 'lwp']),
  ])

  const empRows = (employees ?? []) as { id: string; profile_id: string; employee_code: string | null; joining_date: string | null }[]
  const { data: profiles } = empRows.length
    ? await supabase.from('profiles').select('id, full_name').in('id', empRows.map(e => e.profile_id))
    : { data: [] }
  const nameById = Object.fromEntries(((profiles ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))

  // Every CL/SL/LWP day already on the calendar, per employee
  const usedByEmp: Record<string, { cl: string[]; sl: string[]; lwp: string[] }> = {}
  for (const a of (leaveDays ?? []) as { employee_id: string; date: string; status: 'cl' | 'sl' | 'lwp' }[]) {
    (usedByEmp[a.employee_id] ??= { cl: [], sl: [], lwp: [] })[a.status].push(a.date)
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const balances = empRows.map(e => {
    const used = usedByEmp[e.id] ?? { cl: [], sl: [], lwp: [] }
    return {
      employee_id: e.id,
      name: nameById[e.profile_id] ?? '—',
      employee_code: e.employee_code,
      joining_date: e.joining_date,
      cl: balanceFor('cl', { joiningDate: e.joining_date, year, month, usedDates: used.cl, settings }),
      sl: balanceFor('sl', { joiningDate: e.joining_date, year, month, usedDates: used.sl, settings }),
      lwpDays: used.lwp.length,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  const requestRows = ((requests ?? []) as any[]).map(r => ({
    ...r,
    employee_name: nameById[empRows.find(e => e.id === r.employee_id)?.profile_id ?? ''] ?? '—',
  }))

  return (
    <LeaveClient
      requests={requestRows}
      balances={balances}
      holidays={(holidays ?? []) as any[]}
      employees={empRows.map(e => ({ id: e.id, name: nameById[e.profile_id] ?? '—' })).sort((a, b) => a.name.localeCompare(b.name))}
      monthLabel={now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
    />
  )
}

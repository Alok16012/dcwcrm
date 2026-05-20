import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
import { AttendancePunchClient } from '@/components/attendance/AttendancePunchClient'
import { SelfPunchClient } from '@/components/attendance/SelfPunchClient'
import { PageHeader } from '@/components/shared/PageHeader'

export const dynamic = 'force-dynamic'

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single() as { data: { role: string; full_name: string } | null }

  if (!profile) redirect('/login')

  const isAdmin = ['admin', 'backend'].includes(profile.role)

  // ── Employee self-service view ─────────────────────────────────────────────
  if (!isAdmin) {
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single() as { data: { id: string } | null }

    if (!emp) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-gray-500 font-medium">No employee record found for your account.</p>
          <p className="text-xs text-gray-400 mt-1">Contact admin to set up your employee profile.</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <PageHeader title="Attendance" description="Mark your daily attendance" />
        <SelfPunchClient employeeId={emp.id} employeeName={profile.full_name} />
      </div>
    )
  }

  // ── Admin table view ───────────────────────────────────────────────────────
  const params = await searchParams
  const today  = format(new Date(), 'yyyy-MM-dd')
  const date   = params.date ?? today

  const { data: employees } = await supabase
    .from('employees')
    .select('id, profile_id')
    .eq('is_active', true)

  const empList = (employees ?? []) as { id: string; profile_id: string }[]
  const profileIds = empList.map(e => e.profile_id)

  const { data: profiles } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', profileIds).order('full_name')
    : { data: [] }

  const profileMap = Object.fromEntries(
    ((profiles ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name])
  )

  const { data: attData } = await supabase
    .from('attendance')
    .select('employee_id, status, clock_in, clock_out')
    .eq('date', date)

  const attMap: Record<string, { status: string; clock_in: string | null; clock_out: string | null }> = {}
  for (const a of (attData ?? []) as { employee_id: string; status: string; clock_in: string | null; clock_out: string | null }[]) {
    attMap[a.employee_id] = a
  }

  const employeeRows = empList.map(e => {
    const att = attMap[e.id]
    return {
      employee_id:   e.id,
      employee_name: profileMap[e.profile_id] ?? '—',
      punch_in:      att?.clock_in  ? att.clock_in.slice(0, 5)  : null,
      punch_out:     att?.clock_out ? att.clock_out.slice(0, 5) : null,
      status:        (att?.status ?? null) as 'present' | 'half_day' | 'absent' | null,
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Daily punch in / punch out — 11:00 AM to 6:00 PM (7 hrs working)"
      />
      <AttendancePunchClient date={date} employees={employeeRows} />
    </div>
  )
}

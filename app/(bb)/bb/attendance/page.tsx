import { createServerClient } from '@/lib/supabase/server'
import { asLoose } from '@/lib/bb/db'
import { isBbManagerRole } from '@/lib/bb/constants'
import AttendanceClient, { type AttendanceStaff, type AttendanceCell } from '@/components/bb/AttendanceClient'
import { format, getDaysInMonth } from 'date-fns'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic'

export default async function BbAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const supabase = await createServerClient()
  const db = asLoose(supabase)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user!.id).single()) as { data: { role: string } | null }

  const sp = await searchParams
  const now = new Date()
  const month = Number(sp.month ?? now.getMonth() + 1)
  const year = Number(sp.year ?? now.getFullYear())

  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const last = `${year}-${String(month).padStart(2, '0')}-${String(getDaysInMonth(new Date(year, month - 1))).padStart(2, '0')}`

  const [employeesRes, attendanceRes] = await Promise.all([
    db.from('bb_employees').select('id, profile_id, employee_code').eq('is_active', true),
    db.from('bb_attendance').select('employee_id, date, status').gte('date', first).lte('date', last),
  ])

  const employees = (employeesRes.data ?? []) as any[]
  const profileIds = employees.map(e => e.profile_id)
  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
    : { data: [] }
  const nameById = Object.fromEntries(((profiles ?? []) as any[]).map(p => [p.id, p.full_name]))

  const staff: AttendanceStaff[] = employees
    .map(e => ({
      id: e.id,
      name: nameById[e.profile_id] ?? e.employee_code,
      employee_code: e.employee_code,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(new Date(year, month - 1), 'MMMM yyyy')} — this is what drives loss of pay in salary
        </p>
      </div>
      <AttendanceClient
        staff={staff}
        cells={(attendanceRes.data ?? []) as AttendanceCell[]}
        month={month}
        year={year}
        currentUserId={user!.id}
        canEdit={isBbManagerRole(profile?.role)}
      />
    </div>
  )
}

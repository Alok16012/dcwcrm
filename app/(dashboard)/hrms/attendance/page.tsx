import { redirect } from 'next/navigation'
import { getMonth, getYear } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
import AttendanceGrid from '@/components/hrms/AttendanceGrid'
import type { AttendanceStatus } from '@/types/app.types'

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string }
}) {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  const now = new Date()
  const month = Number(searchParams.month ?? getMonth(now) + 1)
  const year = Number(searchParams.year ?? getYear(now))
  const monthStr = `${year}-${String(month).padStart(2, '0')}`

  const [empRes, attRes] = await Promise.all([
    supabase.from('employees').select('id, profile_id').eq('is_active', true),
    supabase.from('attendance').select('employee_id, date, status').gte('date', `${monthStr}-01`).lte('date', `${monthStr}-31`),
  ])
  const employeeIds = (empRes.data ?? []).map((e) => (e as { id: string; profile_id: string }).profile_id)
  const profilesRes = employeeIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', employeeIds)
    : { data: [] }
  const profileMap = Object.fromEntries(((profilesRes.data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]))
  const employees = (empRes.data as { id: string; profile_id: string }[] | null)
  const attendanceRaw = attRes.data as { employee_id: string; date: string; status: string }[] | null

  const attendanceByEmp: Record<string, Record<number, AttendanceStatus>> = {}
  for (const a of attendanceRaw ?? []) {
    if (!attendanceByEmp[a.employee_id]) attendanceByEmp[a.employee_id] = {}
    const day = Number(a.date.split('-')[2])
    attendanceByEmp[a.employee_id][day] = a.status as AttendanceStatus
  }

  const data = (employees ?? []).map((e) => ({
    employee_id: e.id,
    employee_name: profileMap[e.profile_id] ?? '—',
    attendance: attendanceByEmp[e.id] ?? {},
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Monthly attendance for all employees</p>
      </div>
      <AttendanceGrid data={data} year={year} month={month} />
    </div>
  )
}

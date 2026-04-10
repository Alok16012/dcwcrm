import { redirect } from 'next/navigation'
import { getMonth, getYear, format, addDays } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
import AttendanceGrid from '@/components/hrms/AttendanceGrid'
import type { AttendanceStatus } from '@/types/app.types'

export const dynamic = 'force-dynamic'

function getCycleDates(year: number, month: number, cycleStartDay: number) {
  // For selected "month/year", return the cycle that belongs to that period
  if (cycleStartDay === 1) {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0) // last day of month
    return { start, end }
  }
  // e.g. cycle_start=17, month=April 2026 → Mar 17 to Apr 16
  const start = new Date(year, month - 2, cycleStartDay)
  const end = new Date(year, month - 1, cycleStartDay - 1)
  return { start, end }
}

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

  // Fetch employees with cycle info
  const { data: employees } = await supabase
    .from('employees')
    .select('id, profile_id, salary_cycle_start_day')
    .eq('is_active', true)

  const empList = (employees ?? []) as { id: string; profile_id: string; salary_cycle_start_day: number }[]

  // Get profile names
  const profileIds = empList.map((e) => e.profile_id)
  const { data: profiles } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
    : { data: [] }
  const profileMap = Object.fromEntries(((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]))

  // Calculate cycle dates per employee & find full date range
  const empCycles = empList.map((e) => {
    const cycleDay = e.salary_cycle_start_day ?? 1
    const { start, end } = getCycleDates(year, month, cycleDay)
    return { ...e, cycleStart: start, cycleEnd: end }
  })

  // Full range to fetch attendance: min(cycleStart) to max(cycleEnd)
  const allStarts = empCycles.map((e) => e.cycleStart.getTime())
  const allEnds = empCycles.map((e) => e.cycleEnd.getTime())
  const rangeStart = allStarts.length > 0 ? new Date(Math.min(...allStarts)) : new Date(year, month - 1, 1)
  const rangeEnd = allEnds.length > 0 ? new Date(Math.max(...allEnds)) : new Date(year, month, 0)

  const fromStr = format(rangeStart, 'yyyy-MM-dd')
  const toStr = format(rangeEnd, 'yyyy-MM-dd')

  const { data: attRaw } = await supabase
    .from('attendance')
    .select('employee_id, date, status')
    .gte('date', fromStr)
    .lte('date', toStr)

  // Build attendance map: empId → { dateStr → status }
  const attMap: Record<string, Record<string, AttendanceStatus>> = {}
  for (const a of (attRaw ?? []) as { employee_id: string; date: string; status: string }[]) {
    if (!attMap[a.employee_id]) attMap[a.employee_id] = {}
    attMap[a.employee_id][a.date] = a.status as AttendanceStatus
  }

  const data = empCycles.map((e) => ({
    employee_id: e.id,
    employee_name: profileMap[e.profile_id] ?? '—',
    cycle_start: format(e.cycleStart, 'yyyy-MM-dd'),
    cycle_end: format(e.cycleEnd, 'yyyy-MM-dd'),
    attendance: attMap[e.id] ?? {},
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Cycle-wise attendance for all employees</p>
      </div>
      <AttendanceGrid
        data={data}
        year={year}
        month={month}
        rangeStart={fromStr}
        rangeEnd={toStr}
      />
    </div>
  )
}

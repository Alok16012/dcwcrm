import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import BiometricClient from '@/components/hrms/BiometricClient'
import type { BiometricDevice, BiometricPunch, MappableEmployee } from '@/components/hrms/BiometricClient'

export const dynamic = 'force-dynamic'

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export default async function BiometricPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = (await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()) as { data: { role: string } | null }

  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  const sp = await searchParams
  const date = sp.date ?? todayIST()

  // The generated Database types predate these tables; the queries below are
  // plain selects, so a loose client here is safer than a stale type.
  const db = supabase as unknown as {
    from: (table: string) => any
  }

  const [devicesRes, punchesRes, employeesRes] = await Promise.all([
    db
      .from('biometric_devices')
      .select('id, name, model, serial_no, ip_address, location, is_active, last_seen_at, last_event_at, agent_version')
      .order('created_at', { ascending: true }),
    db
      .from('biometric_punches')
      .select('id, biometric_user_id, card_no, card_name, employee_id, punch_time, punched_at, method, direction, status, device_serial, source')
      .eq('punch_date', date)
      .order('punched_at', { ascending: false })
      .limit(500),
    db
      .from('employees')
      .select('id, profile_id, employee_code, department, designation, biometric_user_id, biometric_card_no')
      .eq('is_active', true),
  ])

  const devices = (devicesRes.data ?? []) as BiometricDevice[]
  const punches = (punchesRes.data ?? []) as BiometricPunch[]

  const employeeRows = (employeesRes.data ?? []) as {
    id: string
    profile_id: string
    employee_code: string
    department: string | null
    designation: string | null
    biometric_user_id: string | null
    biometric_card_no: string | null
  }[]

  // Names live on profiles, as everywhere else in HRMS.
  const profileIds = employeeRows.map(e => e.profile_id)
  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
    : { data: [] }
  const nameById = Object.fromEntries(
    ((profiles ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name])
  )

  const employees: MappableEmployee[] = employeeRows
    .map(e => ({
      id: e.id,
      name: nameById[e.profile_id] ?? e.employee_code,
      employee_code: e.employee_code,
      department: e.department,
      biometric_user_id: e.biometric_user_id,
      biometric_card_no: e.biometric_card_no,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const employeeNameById = Object.fromEntries(employees.map(e => [e.id, e.name]))

  // Every device identity seen today that no employee claims — these are the
  // punches silently doing nothing until someone maps them.
  const unmappedMap = new Map<string, { userId: string | null; cardNo: string | null; name: string | null; count: number; lastAt: string }>()
  for (const p of punches) {
    if (p.employee_id) continue
    const key = p.biometric_user_id ?? p.card_no ?? 'anon'
    const existing = unmappedMap.get(key)
    if (existing) {
      existing.count++
    } else {
      unmappedMap.set(key, {
        userId: p.biometric_user_id,
        cardNo: p.card_no,
        name: p.card_name,
        count: 1,
        lastAt: p.punched_at,
      })
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Biometric Attendance</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Live punches from the Dahua face recognition controller
        </p>
      </div>

      <BiometricClient
        date={date}
        devices={devices}
        punches={punches}
        employees={employees}
        employeeNameById={employeeNameById}
        unmapped={[...unmappedMap.values()].sort((a, b) => b.count - a.count)}
      />
    </div>
  )
}

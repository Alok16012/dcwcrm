import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import EmployeeTable from '@/components/hrms/EmployeeTable'

export default async function HrmsPage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (!profile || profile.role !== 'admin') redirect('/')

  const { data: empRaw, error } = await supabase
    .from('employees')
    .select('id, profile_id, employee_code, department, designation, joining_date, is_active')
    .order('joining_date', { ascending: false })

  if (error) {
    return <div className="p-4 text-red-500">Failed to load employees: {error.message}</div>
  }

  const empData = empRaw as { id: string; profile_id: string; employee_code: string; department: string | null; designation: string | null; joining_date: string | null; is_active: boolean }[] | null
  const profileIds = (empData ?? []).map((e) => e.profile_id)
  const { data: profRaw } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, role').in('id', profileIds)
    : { data: [] }
  const profMap = Object.fromEntries(((profRaw ?? []) as { id: string; full_name: string; role: string }[]).map((p) => [p.id, p]))

  const rows = (empData ?? []).map((e) => ({
    id: e.id,
    profile_id: e.profile_id,
    employee_code: e.employee_code,
    full_name: profMap[e.profile_id]?.full_name ?? '—',
    role: (profMap[e.profile_id]?.role ?? 'telecaller') as import('@/types/app.types').UserRole,
    department: e.department ?? '—',
    designation: e.designation ?? '—',
    joining_date: e.joining_date ?? '—',
    status: (e.is_active ? 'active' : 'inactive') as 'active' | 'inactive',
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Employees</h1>
        <p className="text-sm text-muted-foreground">Manage staff and their details</p>
      </div>
      <EmployeeTable data={rows} />
    </div>
  )
}

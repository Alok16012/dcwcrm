import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import AdvanceManager from '@/components/hrms/AdvanceManager'

export const dynamic = 'force-dynamic'

export default async function AdvancesPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  // Active employees for the picker
  const { data: empRaw } = await supabase
    .from('employees')
    .select('id, profile_id')
    .eq('is_active', true)
  const emps = (empRaw ?? []) as { id: string; profile_id: string }[]

  const profileIds = emps.map(e => e.profile_id)
  const { data: profs } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, role').in('id', profileIds)
    : { data: [] }
  const profMap = Object.fromEntries(
    ((profs ?? []) as { id: string; full_name: string; role: string }[]).map(p => [p.id, p])
  )

  // Only real salaried staff — associates and students are not employees
  const NON_EMPLOYEE_ROLES = new Set(['associate', 'student'])

  const employees = emps
    .map(e => ({ id: e.id, name: profMap[e.profile_id]?.full_name ?? '—', role: profMap[e.profile_id]?.role }))
    .filter(e => e.role && !NON_EMPLOYEE_ROLES.has(e.role))
    .map(e => ({ id: e.id, name: e.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Advance Salary</h1>
        <p className="text-sm text-muted-foreground">
          Advance dein aur track karein — pending advance agle payroll me apne aap kat jayega
        </p>
      </div>
      <AdvanceManager employees={employees} />
    </div>
  )
}

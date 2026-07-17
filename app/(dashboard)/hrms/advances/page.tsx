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
    ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
    : { data: [] }
  const nameMap = Object.fromEntries(((profs ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))

  const employees = emps
    .map(e => ({ id: e.id, name: nameMap[e.profile_id] ?? '—' }))
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

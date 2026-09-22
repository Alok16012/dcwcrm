import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import RegularizationClient from '@/components/hrms/RegularizationClient'

export const dynamic = 'force-dynamic'

export default async function RegularizationPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user.id).single()) as { data: { role: string } | null }
  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  const db = supabase as unknown as { from: (t: string) => any }

  const [{ data: employees }, { data: requests }, { data: permissions }, { data: audit }] = await Promise.all([
    db.from('employees').select('id, profile_id, employee_code').eq('is_active', true),
    db.from('attendance_regularizations')
      .select('id, employee_id, work_date, punch_type, requested_in, requested_out, reason, status, rejection_reason, created_at')
      .order('created_at', { ascending: false }).limit(200),
    db.from('special_late_permissions')
      .select('id, employee_id, work_date, allowed_till, reason')
      .order('work_date', { ascending: false }).limit(100),
    db.from('hrms_audit_logs')
      .select('id, entity, action, reason, changed_by_name, created_at, new_value')
      .order('created_at', { ascending: false }).limit(50),
  ])

  const empRows = (employees ?? []) as { id: string; profile_id: string; employee_code: string | null }[]
  const { data: profiles } = empRows.length
    ? await supabase.from('profiles').select('id, full_name').in('id', empRows.map(e => e.profile_id))
    : { data: [] }
  const nameByProfile = Object.fromEntries(((profiles ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))
  const nameByEmp = Object.fromEntries(empRows.map(e => [e.id, nameByProfile[e.profile_id] ?? '—']))

  const withNames = <T extends { employee_id: string }>(rows: T[]) =>
    rows.map(r => ({ ...r, employee_name: nameByEmp[r.employee_id] ?? '—' }))

  return (
    <RegularizationClient
      requests={withNames((requests ?? []) as any[])}
      permissions={withNames((permissions ?? []) as any[])}
      auditLog={(audit ?? []) as any[]}
      employees={empRows.map(e => ({ id: e.id, name: nameByEmp[e.id] })).sort((a, b) => a.name.localeCompare(b.name))}
    />
  )
}

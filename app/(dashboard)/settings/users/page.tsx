import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UsersSettingsClient } from './client'

export default async function UsersSettingsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  if (!['admin', 'backend'].includes(profile?.role ?? '')) redirect('/')

  const [{ data: users }, { data: employees }, { data: associates }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    (supabase as any)
      .from('employees')
      .select('id, employee_code, department, designation, joining_date, is_active, basic_salary, profile:profiles(id, full_name, email, phone, role)')
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('associates')
      .select('id, name, email, phone, associate_code, status, current_city, current_state, wallet_balance, created_at')
      .order('created_at', { ascending: false }),
  ])

  return <UsersSettingsClient users={users ?? []} employees={employees ?? []} associates={associates ?? []} />
}

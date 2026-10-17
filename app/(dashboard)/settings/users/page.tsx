import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UsersSettingsClient } from './client'
import { BB_ROLES } from '@/lib/bb/constants'

export default async function UsersSettingsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  if (!['admin', 'backend'].includes(profile?.role ?? '')) redirect('/')

  const [{ data: users }, { data: employees }, { data: associates, error: associatesError }] = await Promise.all([
    // Berojgar Bharat accounts are managed on its own Team page, not here.
    supabase.from('profiles').select('*')
      .not('role', 'in', `(${BB_ROLES.join(',')})`)
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('employees')
      .select('id, employee_code, department, designation, joining_date, is_active, basic_salary, profile:profiles(id, full_name, email, phone, role)')
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('associates')
      .select('id, name, email, phone, associate_code, status, current_city, current_state, wallet_balance, created_at, user_id')
      .order('created_at', { ascending: false }),
  ])

  if (associatesError) console.error('settings/users: associates', associatesError.message)

  return <UsersSettingsClient users={users ?? []} employees={employees ?? []} associates={associates ?? []} />
}

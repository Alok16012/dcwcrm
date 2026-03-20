import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UsersSettingsClient } from './client'

export default async function UsersSettingsPage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  if (!['admin', 'backend'].includes(profile?.role ?? '')) redirect('/')

  const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })

  return <UsersSettingsClient users={users ?? []} />
}

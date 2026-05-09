import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BackendClientWrapper from './client-wrapper'

export default async function BackendPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null }
  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  return <BackendClientWrapper />
}

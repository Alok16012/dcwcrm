import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import AnalyticsClient from './analytics-client'

export default async function AnalyticsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (!profile || profile.role !== 'admin') redirect('/')

  return <AnalyticsClient role={profile.role} />
}

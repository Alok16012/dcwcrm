import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import AnalyticsClient from './analytics-client'

export default async function AnalyticsPage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  return <AnalyticsClient />
}

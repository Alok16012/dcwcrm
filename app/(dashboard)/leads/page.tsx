import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeadsClient } from './client'

export default async function LeadsPage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  return <LeadsClient />
}

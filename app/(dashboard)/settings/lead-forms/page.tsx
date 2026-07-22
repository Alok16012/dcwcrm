import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { LeadFormsClient } from './client'

export const dynamic = 'force-dynamic'

export default async function LeadFormsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null }
  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  const { data: forms } = await supabase
    .from('lead_capture_forms')
    .select('*')
    .order('created_at', { ascending: false })

  return <LeadFormsClient forms={(forms ?? []) as never[]} />
}

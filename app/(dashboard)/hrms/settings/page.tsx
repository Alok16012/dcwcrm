import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import HrmsSettingsClient from '@/components/hrms/HrmsSettingsClient'
import { DEFAULT_SETTINGS } from '@/lib/hrms/attendance-rules'

export const dynamic = 'force-dynamic'

export default async function HrmsSettingsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user.id).single()) as { data: { role: string } | null }
  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  const db = supabase as unknown as { from: (t: string) => any }
  const { data } = await db.from('hrms_settings').select('*').eq('id', true).maybeSingle()

  return <HrmsSettingsClient initial={data ?? DEFAULT_SETTINGS} exists={!!data} />
}

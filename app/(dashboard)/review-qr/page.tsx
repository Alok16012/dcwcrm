import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ReviewQrClient } from './client'

export const dynamic = 'force-dynamic'

export default async function ReviewQrAdminPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null }
  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  return <ReviewQrClient />
}

import { getCurrentProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeadsClient } from './client'
import type { Profile } from '@/types/app.types'

export default async function LeadsPage() {
  // Already fetched by the layout in this request (cached), so this is free —
  // and the client no longer has to look the user + profile up again itself
  // before it can ask for a single lead.
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  return <LeadsClient initialProfile={profile as unknown as Profile} />
}

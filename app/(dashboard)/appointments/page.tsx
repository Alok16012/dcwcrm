import { redirect } from 'next/navigation'
import { addDays, format, subDays } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
import { HOST_ROLES } from '@/lib/appointments/constants'
import AppointmentsClient from './client'

export const dynamic = 'force-dynamic'

export default async function AppointmentsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single() as { data: { id: string; full_name: string; role: string } | null }

  if (!profile || !(HOST_ROLES as unknown as string[]).includes(profile.role)) redirect('/dashboard')

  const now = new Date()
  const fetchStart = format(subDays(now, 14), 'yyyy-MM-dd')
  const fetchEnd = format(addDays(now, 60), 'yyyy-MM-dd')

  // appointments_select RLS already grants every admin/lead/counselor the
  // whole table — the slot browser needs everyone's bookings visible to
  // avoid double-booking, so unlike /targets there's no per-assignee
  // filtering to route around and no service-role client is needed here.
  const [hostsRes, appointmentsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', HOST_ROLES as unknown as string[])
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('appointments')
      .select('*, lead:leads(id, full_name, phone), host:profiles!appointments_host_id_fkey(id, full_name), creator:profiles!appointments_created_by_fkey(id, full_name)')
      .gte('scheduled_date', fetchStart)
      .lte('scheduled_date', fetchEnd)
      .order('scheduled_date', { ascending: false })
      .order('scheduled_time', { ascending: false }),
  ])

  return (
    <AppointmentsClient
      currentUserId={profile.id}
      role={profile.role}
      hosts={(hostsRes.data ?? []) as any[]}
      initialAppointments={(appointmentsRes.data ?? []) as any[]}
    />
  )
}

import { createServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { LeadDetailClient } from './client'

interface Props {
  params: { id: string }
}

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: lead } = await supabase
    .from('leads')
    .select(`
      *,
      course:courses(id, name, is_active, created_at),
      sub_course:sub_courses(id, name, is_active, created_at, course_id),
      assigned_user:profiles!leads_assigned_to_fkey(id, email, full_name, role, is_active, created_at)
    `)
    .eq('id', id)
    .single()

  if (!lead) notFound()

  let activities: any[] = []
  try {
    const { data } = await supabase
      .from('lead_activities')
      .select('*, performer:profiles!lead_activities_performed_by_fkey(id, email, full_name, role, is_active, created_at)')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
    activities = data ?? []
  } catch (err) {
    console.error('Failed to fetch activities:', err)
  }

  let payments: any[] = []
  try {
    const { data } = await supabase
      .from('payments')
      .select('*, recorder:profiles!recorded_by(id, email, full_name, role, is_active, created_at)')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
    payments = data ?? []
  } catch (err) {
    console.error('Failed to fetch payments:', err)
  }

  return (
    <LeadDetailClient
      lead={lead as never}
      activities={(activities ?? []) as never}
      payments={(payments ?? []) as never}
    />
  )
}

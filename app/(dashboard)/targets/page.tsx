import { redirect } from 'next/navigation'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { loadRevenueTargets } from '@/lib/revenue-target-store'
import TargetsClient from './client'

export const dynamic = 'force-dynamic'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export default async function TargetsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single() as { data: { id: string; full_name: string; role: string } | null }

  if (!profile || !['admin', 'lead', 'counselor'].includes(profile.role)) redirect('/')

  const now = new Date()
  const defaultStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const defaultEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const fetchStart = format(startOfMonth(subMonths(now, 3)), 'yyyy-MM-dd')
  const fetchEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const dataClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const [counselorRes, storedTargets, paymentRes, leadRes] = await Promise.all([
    dataClient
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['lead', 'counselor'])
      .eq('is_active', true)
      .order('full_name'),
    loadRevenueTargets(),
    dataClient
      .from('payments')
      .select(`
        id, amount, payment_date,
        lead:leads(assigned_to, full_name),
        student:students(assigned_counsellor, full_name)
      `)
      .gte('payment_date', fetchStart)
      .lte('payment_date', fetchEnd)
      .order('payment_date', { ascending: false }),
    dataClient
      .from('leads')
      .select('id, full_name, assigned_to, status, created_at, assigned_at, converted_at')
      .gte('created_at', fetchStart)
      .lte('created_at', fetchEnd),
  ])

  const counselors = profile.role === 'admin'
    ? ((counselorRes.data ?? []) as any[])
    : [{ id: profile.id, full_name: profile.full_name, role: profile.role }]
  const counselorById = new Map(counselors.map(c => [c.id, c]))
  const targets = storedTargets
    .filter(target => target.end_date >= fetchStart && target.start_date <= fetchEnd)
    .filter(target => profile.role === 'admin' || target.assignee_id === profile.id)
    .map(target => ({ ...target, assignee: counselorById.get(target.assignee_id) ?? null }))
  const paymentRows = ((paymentRes.data ?? []) as any[]).filter(payment => {
    if (profile.role === 'admin') return true
    const student = one<{ assigned_counsellor: string | null }>(payment.student)
    const lead = one<{ assigned_to: string | null }>(payment.lead)
    return (student?.assigned_counsellor || lead?.assigned_to) === profile.id
  })
  const leadRows = ((leadRes.data ?? []) as any[]).filter(lead => profile.role === 'admin' || lead.assigned_to === profile.id)

  return (
    <TargetsClient
      currentUserId={profile.id}
      role={profile.role}
      counselors={counselors}
      initialTargets={targets as any[]}
      payments={paymentRows}
      leads={leadRows}
      defaultStart={defaultStart}
      defaultEnd={defaultEnd}
    />
  )
}

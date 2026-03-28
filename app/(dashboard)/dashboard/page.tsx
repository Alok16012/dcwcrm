import { redirect } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
import DashboardClient from '../dashboard-client'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  const { data: profile } = user ? await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null } : { data: null }

  // Non-admin users get redirected to their module (excluding telecallers who now have access)
  if (profile?.role === 'backend') redirect('/backend')

  const now = new Date()
  const todayStart = format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss")
  const todayEnd = format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss")
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const todayDate = format(now, 'yyyy-MM-dd')

  const isLead = profile?.role === 'lead' || profile?.role === 'telecaller'

  const applyScope = (q: any, table: string) => {
    if (isLead) {
      if (table === 'leads') return q.eq('assigned_to', user!.id)
      if (table === 'students') return q.eq('assigned_counsellor', user!.id)
    }
    return q
  }

  // For telecaller: scope payments & pending docs by their assigned students
  let telecallerStudentIds: string[] = []
  if (isLead) {
    const { data: assignedStudents } = await supabase
      .from('students')
      .select('id')
      .eq('assigned_counsellor', user!.id)
    telecallerStudentIds = ((assignedStudents ?? []) as { id: string }[]).map((s) => s.id)
  }

  const paymentsQuery = isLead
    ? (telecallerStudentIds.length > 0
        ? supabase.from('payments').select('amount').in('student_id', telecallerStudentIds).gte('payment_date', monthStart).lte('payment_date', monthEnd)
        : supabase.from('payments').select('amount').eq('recorded_by', user!.id).gte('payment_date', monthStart).lte('payment_date', monthEnd))
    : supabase.from('payments').select('amount').gte('payment_date', monthStart).lte('payment_date', monthEnd)

  const pendingDocsQuery = isLead && telecallerStudentIds.length > 0
    ? supabase.from('student_documents').select('*', { count: 'exact', head: true }).eq('status', 'pending').in('student_id', telecallerStudentIds)
    : supabase.from('student_documents').select('*', { count: 'exact', head: true }).eq('status', 'pending')

  const [
    { count: totalLeads },
    { count: newToday },
    { count: convertedThisMonth },
    { count: totalLeadsForRate },
    { data: paymentsThisMonth },
    { data: studentFees },
    { count: activeStudents },
    { count: pendingDocs },
    { data: recentLeadsRaw },
    { data: followupLeads },
    { data: topConverters },
  ] = await Promise.all([
    applyScope(supabase.from('leads').select('*', { count: 'exact', head: true }), 'leads'),
    applyScope(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', todayStart).lte('created_at', todayEnd), 'leads'),
    applyScope(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'converted').gte('converted_at', monthStart).lte('converted_at', monthEnd), 'leads'),
    applyScope(supabase.from('leads').select('*', { count: 'exact', head: true }), 'leads'),
    paymentsQuery,
    applyScope(supabase.from('students').select('total_fee, amount_paid'), 'students'),
    applyScope(supabase.from('students').select('*', { count: 'exact', head: true }), 'students'),
    pendingDocsQuery,
    applyScope(supabase.from('leads').select('id, full_name, status, created_at, courses ( name )'), 'leads').order('created_at', { ascending: false }).limit(10),
    applyScope(supabase.from('leads').select('id, full_name, phone, assigned_to, profiles!assigned_to ( full_name )'), 'leads').eq('next_followup_date', todayDate),
    applyScope(supabase.from('leads').select('assigned_to, profiles!assigned_to ( id, full_name )'), 'leads').eq('status', 'converted').gte('converted_at', monthStart).lte('converted_at', monthEnd),
  ])

  const feeCollectedThisMonth = ((paymentsThisMonth ?? []) as { amount: number }[]).reduce((s, p) => s + (p.amount ?? 0), 0)
  const outstandingFees = ((studentFees ?? []) as { total_fee: number | null; amount_paid: number | null }[]).reduce((s, r) => s + Math.max(0, (r.total_fee ?? 0) - (r.amount_paid ?? 0)), 0)

  const conversionCount = convertedThisMonth ?? 0
  const totalCount = totalLeadsForRate ?? 1
  const conversionRate = ((conversionCount / totalCount) * 100).toFixed(1) + '%'

  const recentLeads = ((recentLeadsRaw ?? []) as { id: string; full_name: string; status: string; created_at: string; courses: { name: string } | null }[]).map((l) => ({
    id: l.id,
    full_name: l.full_name,
    course_name: l.courses?.name ?? '',
    status: l.status,
    created_at: l.created_at,
  }))

  const followupsToday = ((followupLeads ?? []) as { id: string; full_name: string; phone: string; assigned_to: string | null; profiles: { full_name: string } | null }[]).map((l) => ({
    id: l.id,
    full_name: l.full_name,
    phone: l.phone,
    assigned_to_name: (l.profiles as { full_name: string } | null)?.full_name ?? '—',
  }))

  // Tally top telecallers
  const tallyMap: Record<string, { id: string; full_name: string; conversions: number }> = {}
  for (const l of (topConverters ?? []) as { assigned_to: string | null; profiles: { id: string; full_name: string } | null }[]) {
    const p = l.profiles
    if (!p) continue
    if (!tallyMap[p.id]) tallyMap[p.id] = { id: p.id, full_name: p.full_name, conversions: 0 }
    tallyMap[p.id].conversions++
  }
  const topTelecallers = Object.values(tallyMap)
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5)

  // Fetch incentive data for telecallers
  type IncentiveRow = { month: number; year: number; incentive: number; status: string; net: number }
  let incentiveHistory: IncentiveRow[] = []
  if (isLead && user) {
    const { data: empRow } = await supabase
      .from('employees')
      .select('id')
      .eq('profile_id', user.id)
      .single()
    if (empRow) {
      const { data: payrollRows } = await supabase
        .from('payroll')
        .select('month, year, incentive, status, net')
        .eq('employee_id', (empRow as { id: string }).id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(12)
      incentiveHistory = ((payrollRows ?? []) as IncentiveRow[])
    }
  }

  return (
    <DashboardClient
      totalLeads={totalLeads ?? 0}
      newToday={newToday ?? 0}
      convertedThisMonth={conversionCount}
      conversionRate={conversionRate}
      feeCollectedThisMonth={feeCollectedThisMonth}
      outstandingFees={outstandingFees}
      activeStudents={activeStudents ?? 0}
      pendingDocs={pendingDocs ?? 0}
      recentLeads={recentLeads}
      followupsToday={followupsToday}
      topTelecallers={topTelecallers}
      incentiveHistory={incentiveHistory}
      isLead={isLead}
    />
  )
}

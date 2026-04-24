import { redirect } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
import DashboardClient from '../dashboard-client'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  const isLead = profile?.role === 'lead' || profile?.role === 'telecaller' || profile?.role === 'counselor'

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
    : supabase.from('payments').select('amount')

  const droppedStudentsQuery = applyScope(
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'dropped'),
    'students'
  )

  const [
    { count: totalLeads },
    { count: newToday },
    { count: convertedThisMonth },
    { count: totalLeadsForRate },
    { data: paymentsThisMonth },
    { data: studentFees },
    { count: activeStudents },
    { count: droppedStudents },
    { data: recentLeadsRaw },
    { data: followupLeads },
    { data: telecallersRaw },
    { data: interestedLeadsRaw },
    { data: departmentsRaw },
  ] = await Promise.all([
    applyScope(supabase.from('leads').select('*', { count: 'exact', head: true }), 'leads'),
    applyScope(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', todayStart).lte('created_at', todayEnd), 'leads'),
    applyScope(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'converted').gte('converted_at', monthStart).lte('converted_at', monthEnd), 'leads'),
    applyScope(supabase.from('leads').select('*', { count: 'exact', head: true }), 'leads'),
    paymentsQuery,
    applyScope(supabase.from('students').select('total_fee, amount_paid'), 'students'),
    applyScope(supabase.from('students').select('*', { count: 'exact', head: true }), 'students'),
    droppedStudentsQuery,
    applyScope(supabase.from('leads').select('id, full_name, status, created_at, courses ( name )'), 'leads').order('created_at', { ascending: false }).limit(10),
    applyScope(supabase.from('leads').select('id, full_name, phone, assigned_to, profiles!assigned_to ( full_name )'), 'leads').eq('next_followup_date', todayDate),
    supabase.from('profiles').select('id, full_name').in('role', ['lead', 'telecaller', 'counselor']).eq('is_active', true),
    applyScope(supabase.from('leads').select('assigned_to, created_at').eq('status', 'interested'), 'leads'),
    supabase.from('departments').select('id, name, students(id, amount_paid, total_fee)'),
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

  // Extra stats for telecallers
  let docReceivedCount = 0
  let expectedEnrollmentCount = 0
  if (isLead && user) {
    const [{ count: docCount }, { count: enrollCount }] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('assigned_to', user.id).eq('status', 'document_received'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('assigned_to', user.id).not('enrollment_date', 'is', null),
    ])
    docReceivedCount = docCount ?? 0
    expectedEnrollmentCount = enrollCount ?? 0
  }

  // Tally interested leads (Counselor-wise)
  const tallyMap: Record<string, { id: string; full_name: string; interested_total: number; interested_month: number }> = {}
  
  // Initialize with all active telecallers
  for (const t of (telecallersRaw ?? []) as { id: string; full_name: string }[]) {
    tallyMap[t.id] = { id: t.id, full_name: t.full_name, interested_total: 0, interested_month: 0 }
  }

  // Tally interested leads
  for (const l of (interestedLeadsRaw ?? []) as { assigned_to: string | null; created_at: string }[]) {
    if (l.assigned_to && tallyMap[l.assigned_to]) {
      tallyMap[l.assigned_to].interested_total++
      if (l.created_at >= monthStart && l.created_at <= monthEnd) {
        tallyMap[l.assigned_to].interested_month++
      }
    }
  }

  const counselorInterestedStats = Object.values(tallyMap)
    .sort((a, b) => b.interested_total - a.interested_total)
    .slice(0, 10) // Show top 10 counselors by interested count

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

  // Calculate department stats
  const departmentStats = ((departmentsRaw ?? []) as { id: string; name: string; students: { id: string; amount_paid: number; total_fee: number }[] | null }[]).map(dept => {
    const students = dept.students ?? []
    const total_students = students.length
    const collected_fee = students.reduce((sum, s) => sum + (s.amount_paid ?? 0), 0)
    const pending_fee = students.reduce((sum, s) => sum + Math.max(0, (s.total_fee ?? 0) - (s.amount_paid ?? 0)), 0)
    return {
      id: dept.id,
      name: dept.name,
      total_students,
      collected_fee,
      pending_fee,
    }
  }).sort((a, b) => b.collected_fee - a.collected_fee)

  return (
    <DashboardClient
      totalLeads={totalLeads ?? 0}
      newToday={newToday ?? 0}
      convertedThisMonth={conversionCount}
      conversionRate={conversionRate}
      totalFeeCollected={feeCollectedThisMonth}
      outstandingFees={outstandingFees}
      activeStudents={activeStudents ?? 0}
      droppedStudents={droppedStudents ?? 0}
      followupsToday={followupsToday}
      interestedStats={counselorInterestedStats}
      incentiveHistory={incentiveHistory}
      isLead={isLead}
      docReceivedCount={docReceivedCount}
      expectedEnrollmentCount={expectedEnrollmentCount}
      departmentStats={departmentStats}
    />
  )
}

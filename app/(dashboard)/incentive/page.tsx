import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { redirect } from 'next/navigation'
import { IncentiveClient } from '@/components/incentive/IncentiveClient'

export const dynamic = 'force-dynamic'

export default async function IncentivePage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single() as { data: { role: string } | null }

  if (!rawProfile?.role || !['lead', 'admin', 'backend'].includes(rawProfile.role)) redirect('/')

  // Find employee record for current user
  const { data: empRow } = await supabase
    .from('employees')
    .select('id')
    .eq('profile_id', session.user.id)
    .single()

  const myEmployeeId = empRow ? (empRow as { id: string }).id : null

  // For admin/backend: fetch all employees for the add dialog
  let employees: { id: string; name: string }[] = []
  if (rawProfile.role === 'admin' || rawProfile.role === 'backend') {
    const { data: empsRaw } = await supabase
      .from('employees')
      .select('id, profile_id')
      .order('id')

    if (empsRaw && empsRaw.length > 0) {
      const profileIds = (empsRaw as { id: string; profile_id: string }[]).map((e) => e.profile_id)
      const { data: profsRaw } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', profileIds)

      const profMap = Object.fromEntries(
        ((profsRaw ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name])
      )
      employees = (empsRaw as { id: string; profile_id: string }[]).map((e) => ({
        id: e.id,
        name: profMap[e.profile_id] ?? 'Unknown',
      }))
    }
  }

  // For lead: fetch their students with incentive
  let studentIncentives: { id: string; full_name: string; course_name: string; enrollment_date: string | null; incentive_amount: number }[] = []
  if (rawProfile.role === 'lead') {
    const { data: studs } = await supabase
      .from('students')
      .select('id, full_name, enrollment_date, incentive_amount, course:courses(name)')
      .eq('assigned_counsellor', session.user.id)
      .gt('incentive_amount', 0)
      .order('enrollment_date', { ascending: false })

    studentIncentives = ((studs ?? []) as any[]).map((s) => ({
      id: s.id,
      full_name: s.full_name,
      course_name: s.course?.name ?? '—',
      enrollment_date: s.enrollment_date,
      incentive_amount: s.incentive_amount,
    }))
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Incentives" description="Month-wise incentive status from payroll" />
      <IncentiveClient role={rawProfile.role} myEmployeeId={myEmployeeId} employees={employees} studentIncentives={studentIncentives} />
    </div>
  )
}

import { createServerClient } from '@/lib/supabase/server'
import { asLoose } from '@/lib/bb/db'
import { isBbManagerRole } from '@/lib/bb/constants'
import JobsClient, { type Job, type CompanyOption } from '@/components/bb/JobsClient'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic'

export default async function JobsPage() {
  const supabase = await createServerClient()
  const db = asLoose(supabase)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user!.id).single()) as { data: { role: string } | null }

  const [jobsRes, companiesRes, placementsRes] = await Promise.all([
    db.from('bb_jobs').select('*, bb_companies(name)').order('posted_on', { ascending: false }),
    db.from('bb_companies')
      .select('id, name, commission_type, commission_percent, commission_base, commission_months, commission_fixed_amount')
      .eq('status', 'active')
      .order('name'),
    db.from('bb_placements').select('job_id'),
  ])

  const filled = ((placementsRes.data ?? []) as any[]).reduce<Record<string, number>>((acc, p) => {
    acc[p.job_id] = (acc[p.job_id] ?? 0) + 1
    return acc
  }, {})

  const jobs: Job[] = ((jobsRes.data ?? []) as any[]).map(j => ({
    ...j,
    company_name: j.bb_companies?.name ?? '—',
    filled: filled[j.id] ?? 0,
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Openings we are hiring for</p>
      </div>
      <JobsClient
        jobs={jobs}
        companies={(companiesRes.data ?? []) as CompanyOption[]}
        canEdit={isBbManagerRole(profile?.role)}
      />
    </div>
  )
}

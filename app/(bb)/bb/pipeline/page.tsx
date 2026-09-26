import { createServerClient } from '@/lib/supabase/server'
import { asLoose } from '@/lib/bb/db'
import { isBbManagerRole } from '@/lib/bb/constants'
import PipelineClient, { type Application } from '@/components/bb/PipelineClient'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  const supabase = await createServerClient()
  const db = asLoose(supabase)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user!.id).single()) as { data: { role: string } | null }

  const { data } = await db
    .from('bb_applications')
    .select(`
      id, candidate_id, job_id, company_id, stage, interview_at, offered_salary, created_at,
      bb_candidates ( full_name, phone ),
      bb_jobs ( title, salary_max, salary_period ),
      bb_companies ( name )
    `)
    .order('created_at', { ascending: false })
    .limit(400)

  const applications: Application[] = ((data ?? []) as any[]).map(a => ({
    id: a.id,
    candidate_id: a.candidate_id,
    job_id: a.job_id,
    company_id: a.company_id,
    stage: a.stage,
    interview_at: a.interview_at,
    offered_salary: a.offered_salary,
    created_at: a.created_at,
    candidate_name: a.bb_candidates?.full_name ?? '—',
    candidate_phone: a.bb_candidates?.phone ?? '',
    job_title: a.bb_jobs?.title ?? '—',
    company_name: a.bb_companies?.name ?? '—',
    salary_period: a.bb_jobs?.salary_period ?? 'monthly',
    job_salary_max: a.bb_jobs?.salary_max ?? null,
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Every candidate sent to a job, from applied to joined
        </p>
      </div>
      <PipelineClient
        applications={applications}
        currentUserId={user!.id}
        canPlace={isBbManagerRole(profile?.role)}
      />
    </div>
  )
}

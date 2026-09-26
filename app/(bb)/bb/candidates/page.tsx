import { createServerClient } from '@/lib/supabase/server'
import { asLoose } from '@/lib/bb/db'
import { isBbManagerRole, BB_ROLES } from '@/lib/bb/constants'
import CandidatesClient, { type Candidate, type JobOption, type Person } from '@/components/bb/CandidatesClient'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic'

export default async function CandidatesPage() {
  const supabase = await createServerClient()
  const db = asLoose(supabase)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user!.id).single()) as { data: { role: string } | null }

  const [candidatesRes, staffRes, jobsRes, appsRes] = await Promise.all([
    db.from('bb_candidates').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('profiles')
      .select('id, full_name')
      .in('role', BB_ROLES as unknown as string[])
      .eq('is_active', true)
      .order('full_name'),
    db.from('bb_jobs')
      .select('id, title, company_id, bb_companies(name)')
      .eq('status', 'open')
      .order('posted_on', { ascending: false }),
    db.from('bb_applications').select('candidate_id'),
  ])

  const staff = ((staffRes.data ?? []) as Person[])
  const nameById = Object.fromEntries(staff.map(s => [s.id, s.full_name]))

  const appCounts = ((appsRes.data ?? []) as any[]).reduce<Record<string, number>>((acc, a) => {
    acc[a.candidate_id] = (acc[a.candidate_id] ?? 0) + 1
    return acc
  }, {})

  const candidates: Candidate[] = ((candidatesRes.data ?? []) as any[]).map(c => ({
    ...c,
    assigned_name: c.assigned_to ? nameById[c.assigned_to] ?? '—' : '—',
    applications: appCounts[c.id] ?? 0,
  }))

  const jobs: JobOption[] = ((jobsRes.data ?? []) as any[]).map(j => ({
    id: j.id,
    title: j.title,
    company_id: j.company_id,
    company_name: j.bb_companies?.name ?? '—',
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
        <p className="text-sm text-gray-500 mt-0.5">Job seekers in the pipeline</p>
      </div>
      <CandidatesClient
        candidates={candidates}
        telecallers={staff}
        jobs={jobs}
        currentUserId={user!.id}
        canAssign={isBbManagerRole(profile?.role)}
      />
    </div>
  )
}

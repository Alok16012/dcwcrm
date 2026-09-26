import { createServerClient } from '@/lib/supabase/server'
import { asLoose } from '@/lib/bb/db'
import { isBbManagerRole } from '@/lib/bb/constants'
import CompaniesClient, { type Company } from '@/components/bb/CompaniesClient'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const supabase = await createServerClient()
  const db = asLoose(supabase)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user!.id).single()) as { data: { role: string } | null }

  const [companiesRes, jobsRes, placementsRes] = await Promise.all([
    db.from('bb_companies').select('*').order('name'),
    db.from('bb_jobs').select('company_id, status'),
    db.from('bb_placements').select('company_id'),
  ])

  // Counts are cheap to fold in here and save a per-card query.
  const openJobs = ((jobsRes.data ?? []) as any[]).reduce<Record<string, number>>((acc, j) => {
    if (j.status === 'open') acc[j.company_id] = (acc[j.company_id] ?? 0) + 1
    return acc
  }, {})
  const placed = ((placementsRes.data ?? []) as any[]).reduce<Record<string, number>>((acc, p) => {
    acc[p.company_id] = (acc[p.company_id] ?? 0) + 1
    return acc
  }, {})

  const companies: Company[] = ((companiesRes.data ?? []) as any[]).map(c => ({
    ...c,
    open_jobs: openJobs[c.id] ?? 0,
    placements: placed[c.id] ?? 0,
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Employers we recruit for, and what each one pays us
        </p>
      </div>
      <CompaniesClient companies={companies} canEdit={isBbManagerRole(profile?.role)} />
    </div>
  )
}

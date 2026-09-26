import { createServerClient } from '@/lib/supabase/server'
import { asLoose } from '@/lib/bb/db'
import { isBbManagerRole } from '@/lib/bb/constants'
import PlacementsClient, { type Placement } from '@/components/bb/PlacementsClient'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic'

export default async function PlacementsPage() {
  const supabase = await createServerClient()
  const db = asLoose(supabase)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user!.id).single()) as { data: { role: string } | null }

  const [placementsRes, invoicesRes] = await Promise.all([
    db.from('bb_placements')
      .select(`
        *,
        bb_candidates ( full_name, phone ),
        bb_companies ( name ),
        bb_jobs ( title )
      `)
      .order('joined_on', { ascending: false }),
    db.from('bb_commission_invoices').select('placement_id, amount, amount_received'),
  ])

  const totals = ((invoicesRes.data ?? []) as any[]).reduce<Record<string, { inv: number; rec: number }>>(
    (acc, i) => {
      const t = acc[i.placement_id] ?? { inv: 0, rec: 0 }
      t.inv += Number(i.amount)
      t.rec += Number(i.amount_received)
      acc[i.placement_id] = t
      return acc
    },
    {}
  )

  const placements: Placement[] = ((placementsRes.data ?? []) as any[]).map(p => ({
    ...p,
    candidate_name: p.bb_candidates?.full_name ?? '—',
    candidate_phone: p.bb_candidates?.phone ?? '',
    company_name: p.bb_companies?.name ?? '—',
    job_title: p.bb_jobs?.title ?? '—',
    invoiced: totals[p.id]?.inv ?? 0,
    received: totals[p.id]?.rec ?? 0,
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Placements</h1>
        <p className="text-sm text-gray-500 mt-0.5">Candidates who joined, and what each one earns us</p>
      </div>
      <PlacementsClient placements={placements} canEdit={isBbManagerRole(profile?.role)} />
    </div>
  )
}

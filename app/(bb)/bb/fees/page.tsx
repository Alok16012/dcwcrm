import { createServerClient } from '@/lib/supabase/server'
import { asLoose } from '@/lib/bb/db'
import { isBbManagerRole } from '@/lib/bb/constants'
import FeesClient, { type Charge, type PaymentRow, type CandidateOption } from '@/components/bb/FeesClient'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic'

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export default async function FeesPage() {
  const supabase = await createServerClient()
  const db = asLoose(supabase)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = (await supabase
    .from('profiles').select('role, full_name').eq('id', user!.id).single()) as {
      data: { role: string; full_name: string } | null
    }

  const [chargesRes, paymentsRes, candidatesRes, placementsRes, staffRes] = await Promise.all([
    db.from('bb_candidate_charges')
      .select(`
        *,
        bb_candidates ( full_name, phone, city ),
        bb_placements ( offered_salary, bb_jobs ( title ), bb_companies ( name ) )
      `)
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('bb_candidate_payments')
      .select('id, charge_id, amount, payment_mode, payment_date, reference_no, receipt_number, notes, recorded_by')
      .order('payment_date', { ascending: false })
      .limit(1000),
    db.from('bb_candidates').select('id, full_name, phone, city').order('full_name').limit(500),
    db.from('bb_placements')
      .select('id, candidate_id, offered_salary, bb_jobs ( title ), bb_companies ( name )'),
    supabase.from('profiles').select('id, full_name'),
  ])

  const staffName = Object.fromEntries(
    ((staffRes.data ?? []) as any[]).map(p => [p.id, p.full_name])
  )

  const placementByCandidate = Object.fromEntries(
    ((placementsRes.data ?? []) as any[]).map(p => [p.candidate_id, p])
  )

  const charges: Charge[] = ((chargesRes.data ?? []) as any[]).map(c => ({
    id: c.id,
    candidate_id: c.candidate_id,
    charge_type: c.charge_type,
    basis: c.basis,
    percent: c.percent,
    salary_base: c.salary_base,
    amount: Number(c.amount),
    due_date: c.due_date,
    status: c.status,
    amount_received: Number(c.amount_received),
    notes: c.notes,
    created_at: c.created_at,
    candidate_name: c.bb_candidates?.full_name ?? '—',
    candidate_phone: c.bb_candidates?.phone ?? '',
    candidate_city: c.bb_candidates?.city ?? null,
    job_title: c.bb_placements?.bb_jobs?.title ?? null,
    company_name: c.bb_placements?.bb_companies?.name ?? null,
  }))

  const payments: PaymentRow[] = ((paymentsRes.data ?? []) as any[]).map(p => ({
    id: p.id,
    charge_id: p.charge_id,
    amount: Number(p.amount),
    payment_mode: p.payment_mode,
    payment_date: p.payment_date,
    reference_no: p.reference_no,
    receipt_number: p.receipt_number,
    notes: p.notes,
    recorded_by_name: staffName[p.recorded_by] ?? 'Berojgar Bharat',
  }))

  const candidates: CandidateOption[] = ((candidatesRes.data ?? []) as any[]).map(c => {
    const pl = placementByCandidate[c.id]
    return {
      id: c.id,
      full_name: c.full_name,
      phone: c.phone,
      city: c.city,
      placement_salary: pl ? Number(pl.offered_salary) : null,
      job_title: pl?.bb_jobs?.title ?? null,
      company_name: pl?.bb_companies?.name ?? null,
      placement_id: pl?.id ?? null,
    }
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Candidate Fees</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          What job seekers pay us — every payment gets a numbered receipt
        </p>
      </div>
      <FeesClient
        charges={charges}
        payments={payments}
        candidates={candidates}
        currentUserId={user!.id}
        currentUserName={profile?.full_name ?? 'Berojgar Bharat'}
        today={todayIST()}
        canWaive={isBbManagerRole(profile?.role)}
      />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { asLoose } from '@/lib/bb/db'
import { isBbManagerRole } from '@/lib/bb/constants'
import RevenueClient, { type Invoice } from '@/components/bb/RevenueClient'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic'

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export default async function RevenuePage() {
  const supabase = await createServerClient()
  const db = asLoose(supabase)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user!.id).single()) as { data: { role: string } | null }

  // What a client is billed is not a telecaller's business.
  if (!isBbManagerRole(profile?.role)) redirect('/bb/dashboard')

  const { data } = await db
    .from('bb_commission_invoices')
    .select(`
      id, instalment_no, period_start, period_end, amount, due_date, status,
      invoice_no, amount_received, received_on, placement_id,
      bb_companies ( name ),
      bb_placements (
        commission_months,
        bb_candidates ( full_name ),
        bb_jobs ( title )
      )
    `)
    .order('due_date', { ascending: true })
    .limit(1000)

  const invoices: Invoice[] = ((data ?? []) as any[]).map(i => ({
    id: i.id,
    instalment_no: i.instalment_no,
    period_start: i.period_start,
    period_end: i.period_end,
    amount: Number(i.amount),
    due_date: i.due_date,
    status: i.status,
    invoice_no: i.invoice_no,
    amount_received: Number(i.amount_received),
    received_on: i.received_on,
    company_name: i.bb_companies?.name ?? '—',
    candidate_name: i.bb_placements?.bb_candidates?.full_name ?? '—',
    job_title: i.bb_placements?.bb_jobs?.title ?? '—',
    total_instalments: Number(i.bb_placements?.commission_months ?? 1),
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
        <p className="text-sm text-gray-500 mt-0.5">Commission invoices and what has come in</p>
      </div>
      <RevenueClient invoices={invoices} today={todayIST()} />
    </div>
  )
}

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { resolveTerms, buildSchedule, scheduleTotal } from '@/lib/bb/commission'
import { BB_MANAGER_ROLES } from '@/lib/bb/constants'

/**
 * Record that a candidate joined — the moment a pipeline row becomes revenue.
 *
 * This is a server route rather than a client write because it has to happen
 * as one decision: freeze the commission terms, generate the invoice schedule,
 * and advance the application, candidate and job together. Half of that
 * applied would leave a placement nobody bills for.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user.id).single()) as { data: { role: string } | null }

  if (!profile || !BB_MANAGER_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    application_id?: string
    joined_on?: string
    offered_salary?: number
    salary_period?: 'monthly' | 'annual'
    credited_to?: string | null
    notes?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.application_id || !body.joined_on || !body.offered_salary) {
    return NextResponse.json(
      { error: 'application_id, joined_on and offered_salary are required' },
      { status: 400 }
    )
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const db = admin as any

  // Pull the application together with the two places a deal can live.
  const { data: app, error: appErr } = await db
    .from('bb_applications')
    .select(`
      id, candidate_id, job_id, company_id, stage,
      bb_jobs (
        id, title, openings, status,
        commission_type, commission_percent, commission_base,
        commission_months, commission_fixed_amount
      ),
      bb_companies (
        id, name, payment_terms_days, guarantee_days,
        commission_type, commission_percent, commission_base,
        commission_months, commission_fixed_amount
      )
    `)
    .eq('id', body.application_id)
    .single()

  if (appErr || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const { data: existing } = await db
    .from('bb_placements').select('id').eq('application_id', app.id).maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'This application is already placed' }, { status: 409 })
  }

  const company = app.bb_companies
  const job = app.bb_jobs
  const salaryPeriod = body.salary_period ?? 'monthly'

  const terms = resolveTerms(company, job)
  const schedule = buildSchedule(terms, {
    offeredSalary: Number(body.offered_salary),
    salaryPeriod,
    joinedOn: body.joined_on,
    paymentTermsDays: Number(company?.payment_terms_days ?? 30),
  })
  const total = scheduleTotal(schedule)

  // The terms are copied onto the placement, not referenced. Renegotiating the
  // company's rate later must not move money that is already booked.
  const { data: placement, error: placeErr } = await db
    .from('bb_placements')
    .insert({
      application_id: app.id,
      candidate_id: app.candidate_id,
      job_id: app.job_id,
      company_id: app.company_id,
      joined_on: body.joined_on,
      offered_salary: Number(body.offered_salary),
      salary_period: salaryPeriod,
      commission_type: terms.type,
      commission_percent: terms.percent,
      commission_base: terms.base,
      commission_months: terms.months,
      commission_fixed_amount: terms.fixedAmount,
      total_commission: total,
      guarantee_days: Number(company?.guarantee_days ?? 90),
      credited_to: body.credited_to ?? null,
      notes: body.notes ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (placeErr) {
    return NextResponse.json({ error: placeErr.message }, { status: 400 })
  }

  const { error: invErr } = await db.from('bb_commission_invoices').insert(
    schedule.map(i => ({
      placement_id: placement.id,
      company_id: app.company_id,
      instalment_no: i.instalmentNo,
      period_start: i.periodStart,
      period_end: i.periodEnd,
      amount: i.amount,
      due_date: i.dueDate,
      status: 'pending',
    }))
  )

  if (invErr) {
    // A placement with no invoices is worse than no placement: it looks done
    // and silently never gets billed. Roll it back and report the failure.
    await db.from('bb_placements').delete().eq('id', placement.id)
    return NextResponse.json(
      { error: `Could not create invoices: ${invErr.message}` },
      { status: 400 }
    )
  }

  await db.from('bb_applications').update({ stage: 'joined' }).eq('id', app.id)
  await db.from('bb_candidates').update({ status: 'joined' }).eq('id', app.candidate_id)

  // Close the opening once every seat is taken.
  const { count: filled } = await db
    .from('bb_placements')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', app.job_id)
  if ((filled ?? 0) >= Number(job?.openings ?? 1)) {
    await db.from('bb_jobs').update({ status: 'filled' }).eq('id', app.job_id)
  }

  await db.from('bb_activities').insert({
    candidate_id: app.candidate_id,
    application_id: app.id,
    activity_type: 'placed',
    new_value: `Joined ${job?.title ?? 'job'} at ${company?.name ?? 'company'}`,
    note: `Salary ${body.offered_salary}, commission ${total}`,
    performed_by: user.id,
  })

  return NextResponse.json({
    ok: true,
    placement_id: placement.id,
    total_commission: total,
    invoices: schedule.length,
  })
}

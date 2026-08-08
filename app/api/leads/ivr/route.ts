import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ingestLead } from '@/lib/leads/ingest'

/**
 * Inbound webhook from the DCW-IVR calling app (separate Supabase project).
 *
 * Every call the IVR records is posted here. The caller's number becomes a
 * lead with source = 'ivr', owned by the CRM counsellor whose name matches the
 * IVR agent who took the call (IVR "Aditi" -> CRM "Aditi Krishan"). A number
 * that already exists as a lead is never duplicated — the existing lead gets a
 * call activity and refreshed call details instead.
 */

export const runtime = 'nodejs'

interface IvrCallPayload {
  /** The customer's number — the only genuinely required field. */
  caller?: string
  caller_name?: string
  /** IVR agent who took/was offered the call, e.g. "Aditi", "Purnima". */
  agent_name?: string
  agent_phone?: string
  /** answered | completed | missed | failed ... (IVR call.status) */
  status?: string
  direction?: string
  duration_seconds?: number
  started_at?: string
  /** IVR-side ids, kept for tracing a lead back to its call. */
  call_id?: string
  provider_call_id?: string
  business_number?: string
  recording_ref?: string
}

type Counsellor = { id: string; full_name: string }

/** Last 10 digits — the comparable core of an Indian number in any format. */
function last10(raw: string): string {
  return raw.replace(/\D/g, '').slice(-10)
}

function normalizeName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Match an IVR agent name against the CRM counsellor roster. The IVR usually
 * carries only a first name, so try progressively looser rules and accept a
 * match only when exactly one counsellor qualifies — an ambiguous name must
 * fall through to round-robin rather than reach the wrong person.
 */
export function matchCounsellor(
  agentName: string | undefined,
  counsellors: Counsellor[]
): Counsellor | null {
  if (!agentName) return null
  const target = normalizeName(agentName)
  if (target.length < 3) return null

  const rules: ((c: Counsellor) => boolean)[] = [
    // "Purnima" === "Purnima"
    (c) => normalizeName(c.full_name) === target,
    // "Aditi" === first word of "Aditi Krishan"
    (c) => normalizeName(c.full_name).split(' ')[0] === target,
    // "Aditi Krishan" (IVR) contains "Aditi" (CRM), or the reverse
    (c) => {
      const name = normalizeName(c.full_name)
      return name.length >= 3 && (target.includes(name) || name.includes(target))
    },
  ]

  for (const rule of rules) {
    const hits = counsellors.filter(rule)
    if (hits.length === 1) return hits[0]
    if (hits.length > 1) return null // ambiguous — don't guess
  }
  return null
}

/** Call facts stored on the lead so the counsellor sees why it appeared. */
function callMetadata(body: IvrCallPayload) {
  return {
    lead_source: 'IVR',
    ivr_agent: body.agent_name ?? null,
    ivr_agent_phone: body.agent_phone ?? null,
    call_status: body.status ?? null,
    call_direction: body.direction ?? 'inbound',
    call_duration_seconds: body.duration_seconds ?? 0,
    call_time: body.started_at ?? new Date().toISOString(),
    ivr_call_id: body.call_id ?? null,
    ivr_provider_call_id: body.provider_call_id ?? null,
    ivr_number_dialled: body.business_number ?? null,
    recording_ref: body.recording_ref ?? null,
  }
}

/** A repeat caller: log the call and fill in an owner if the lead had none. */
async function recordRepeatCall(
  supabase: SupabaseClient,
  lead: { id: string; full_name: string; assigned_to: string | null; metadata: Record<string, unknown> | null },
  body: IvrCallPayload,
  counsellor: Counsellor | null
) {
  const meta = callMetadata(body)
  const previousCalls = Number((lead.metadata as { ivr_call_count?: number } | null)?.ivr_call_count ?? 0)

  const update: Record<string, unknown> = {
    metadata: { ...(lead.metadata ?? {}), ...meta, ivr_call_count: previousCalls + 1 },
    updated_at: new Date().toISOString(),
  }
  // Only fill an empty owner — never move a lead someone is already working.
  if (!lead.assigned_to && counsellor) {
    update.assigned_to = counsellor.id
    update.assigned_at = new Date().toISOString()
  }
  await supabase.from('leads').update(update as never).eq('id', lead.id)

  await supabase.from('lead_activities').insert({
    lead_id: lead.id,
    activity_type: 'call_made',
    new_value: body.agent_name
      ? `IVR call (${body.status ?? 'inbound'}) — ${body.agent_name}`
      : `IVR call (${body.status ?? 'inbound'})`,
  } as never)

  const notify = lead.assigned_to ?? counsellor?.id ?? null
  if (notify) {
    await supabase.from('notifications').insert({
      title: 'Purana lead ne dobara call kiya',
      message: `${lead.full_name} ne IVR par dobara call kiya hai — follow up karo!`,
      type: 'info',
      target_user_id: notify,
    } as never)
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.IVR_WEBHOOK_SECRET
  if (!secret) {
    // Failing loudly beats quietly accepting anonymous lead injection.
    return NextResponse.json(
      { error: 'IVR_WEBHOOK_SECRET is not configured on the CRM' },
      { status: 503 }
    )
  }
  const provided =
    req.headers.get('x-webhook-secret') ?? req.nextUrl.searchParams.get('secret')
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: IvrCallPayload
  try {
    body = (await req.json()) as IvrCallPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const phone = last10(body.caller ?? '')
  if (phone.length !== 10) {
    // Private/unknown/short-code callers can't be followed up on.
    return NextResponse.json({ ok: true, ignored: 'no usable caller number' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data: counsellors } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['lead', 'telecaller', 'counselor'])
      .eq('is_active', true)
      .order('full_name')

    const counsellor = matchCounsellor(body.agent_name, (counsellors ?? []) as Counsellor[])

    // Same number already in the CRM? phone_last10 is a generated column, so
    // '+91 98123 45670' and '9812345670' both resolve to the same person.
    const { data: existing } = await supabase
      .from('leads')
      .select('id, full_name, assigned_to, metadata')
      .eq('phone_last10', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      await recordRepeatCall(
        supabase,
        existing as { id: string; full_name: string; assigned_to: string | null; metadata: Record<string, unknown> | null },
        body,
        counsellor
      )
      return NextResponse.json({
        ok: true,
        duplicate: true,
        lead_id: (existing as { id: string }).id,
        matched_agent: counsellor?.full_name ?? null,
      })
    }

    const { leadId, assigneeName } = await ingestLead(supabase, {
      full_name: body.caller_name?.trim() || `IVR Caller ${phone}`,
      phone,
      source: 'ivr',
      metadata: { ...callMetadata(body), ivr_call_count: 1 },
      assignTo: counsellor,
    })

    return NextResponse.json({
      ok: true,
      lead_id: leadId,
      assigned_to: assigneeName ?? 'unassigned',
      // false when the IVR agent name didn't match a counsellor and the lead
      // fell back to round-robin — useful when debugging name mismatches.
      matched_agent: counsellor !== null,
    })
  } catch (error) {
    console.error('IVR lead webhook error:', error)
    return NextResponse.json({ error: 'Failed to record IVR lead' }, { status: 500 })
  }
}

/** Health probe — lets the IVR side confirm the endpoint is reachable. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'IVR lead webhook',
    configured: Boolean(process.env.IVR_WEBHOOK_SECRET),
  })
}

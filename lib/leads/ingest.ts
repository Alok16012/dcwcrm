import type { SupabaseClient } from '@supabase/supabase-js'

export interface IngestLeadInput {
  full_name: string
  phone: string
  email?: string | null
  city?: string | null
  state?: string | null
  source?: string
  metadata?: Record<string, unknown>
  /**
   * Skip round-robin and hand the lead to this profile. Used by the IVR
   * webhook, where the counsellor who actually took the call is already known.
   */
  assignTo?: { id: string; full_name: string } | null
}

export interface IngestLeadResult {
  leadId: string | null
  assigneeId: string | null
  assigneeName: string | null
  /** True when the number already belonged to a lead, so no new row was created. */
  duplicate: boolean
}

type ExistingLead = {
  id: string
  full_name: string
  email: string | null
  city: string | null
  state: string | null
  assigned_to: string | null
  metadata: Record<string, unknown> | null
}

const SOURCE_LABELS: Record<string, string> = {
  google_ads: 'Google Ads', meta_ads: 'Meta Ads', walk_in: 'Walk-in', ivr: 'IVR call',
}

/** The counsellor with the fewest leads from this source today (IST). */
async function pickRoundRobinAssignee(
  supabase: SupabaseClient,
  source: string
): Promise<{ id: string; full_name: string } | null> {
  const { data: agents } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['lead', 'telecaller', 'counselor'])
    .eq('is_active', true)
    .order('id')

  if (!agents || agents.length === 0) return null

  const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000)
  const dayStartIst = new Date(Date.UTC(
    nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()
  ) - 5.5 * 3600 * 1000)

  const { data: todaysLeads } = await supabase
    .from('leads')
    .select('assigned_to')
    .eq('source', source)
    .gte('assigned_at', dayStartIst.toISOString())
    .not('assigned_to', 'is', null)

  const counts = new Map<string, number>(agents.map((a: { id: string }) => [a.id, 0]))
  for (const l of todaysLeads ?? []) {
    const id = (l as { assigned_to: string | null }).assigned_to
    if (id && counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return agents.reduce((best: { id: string; full_name: string }, a: { id: string; full_name: string }) =>
    (counts.get(a.id) ?? 0) < (counts.get(best.id) ?? 0) ? a : best
  )
}

/**
 * The same person submitting again (form double-submit, a second ad click, a
 * walk-in after an enquiry) must not become a second lead handed to a second
 * counsellor. Keep the original lead and owner, log the new enquiry on it and
 * nudge the owner. Only an ownerless lead gets assigned now.
 */
async function recordRepeatEnquiry(
  supabase: SupabaseClient,
  lead: ExistingLead,
  input: IngestLeadInput,
  source: string
): Promise<IngestLeadResult> {
  const now = new Date().toISOString()
  const meta = lead.metadata ?? {}
  const repeatCount = Number((meta as { repeat_enquiry_count?: number }).repeat_enquiry_count ?? 0) + 1
  const sourceLabel = SOURCE_LABELS[source] ?? source

  let assigneeId = lead.assigned_to
  let assigneeName: string | null = null
  const update: Record<string, unknown> = {
    // The original enquiry's answers stay as they were; the latest one is kept alongside
    metadata: {
      ...meta,
      repeat_enquiry_count: repeatCount,
      last_enquiry_at: now,
      last_enquiry_source: sourceLabel,
      last_enquiry: input.metadata ?? {},
    },
    updated_at: now,
  }
  // Fill blanks only — never overwrite details someone already has
  if (!lead.email && input.email) update.email = input.email
  if (!lead.city && input.city) update.city = input.city
  if (!lead.state && input.state) update.state = input.state

  if (!assigneeId) {
    try {
      const winner = input.assignTo ?? await pickRoundRobinAssignee(supabase, source)
      if (winner) {
        assigneeId = winner.id
        assigneeName = winner.full_name
        update.assigned_to = winner.id
        update.assigned_at = now
      }
    } catch (e) {
      console.error('ingestLead repeat auto-assign failed:', e)
    }
  } else {
    const { data: owner } = await supabase.from('profiles').select('full_name').eq('id', assigneeId).maybeSingle()
    assigneeName = (owner as { full_name: string } | null)?.full_name ?? null
  }

  const { error } = await supabase.from('leads').update(update as never).eq('id', lead.id)
  if (error) {
    console.error('ingestLead repeat update error:', error)
    throw new Error(error.message)
  }

  try {
    const form = (input.metadata as { form?: string } | undefined)?.form
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      activity_type: 'note_added',
      new_value: `Dobara enquiry (${repeatCount}x) — ${sourceLabel}${form ? `: ${form}` : ''}`,
    } as never)
    if (assigneeId) {
      await supabase.from('notifications').insert({
        title: 'Purane lead ne dobara enquiry ki',
        message: `${lead.full_name} (${input.phone}) ne ${sourceLabel} se dobara enquiry ki hai — follow up karo!`,
        type: 'info',
        target_user_id: assigneeId,
      } as never)
    }
  } catch (e) {
    console.error('ingestLead repeat (activity/notify) failed:', e)
  }

  return { leadId: lead.id, assigneeId, assigneeName, duplicate: true }
}

/**
 * Insert an inbound lead (Meta webhook / public form / IVR call / walk-in) and,
 * unless the caller already named an owner, distribute it equally among active
 * counselors via round-robin, then notify the assignee in-app. A number that
 * already exists as a lead is not inserted again — see recordRepeatEnquiry.
 *
 * Requires a SERVICE-ROLE supabase client (bypasses RLS, runs server-side only).
 */
export async function ingestLead(
  supabase: SupabaseClient,
  input: IngestLeadInput
): Promise<IngestLeadResult> {
  const source = input.source || 'meta_ads'

  // ── Duplicate check: phone_last10 is a generated column, so '+91 98123 45670'
  // and '9812345670' resolve to the same lead.
  const phoneKey = input.phone.replace(/\D/g, '').slice(-10)
  if (phoneKey.length === 10) {
    const { data: existing } = await supabase
      .from('leads')
      .select('id, full_name, email, city, state, assigned_to, metadata')
      .eq('phone_last10', phoneKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing) return recordRepeatEnquiry(supabase, existing as ExistingLead, input, source)
  }

  // ── Assign: an explicit owner (IVR — the counsellor who took the call) wins;
  // otherwise round-robin across the team.
  let assignedTo: string | null = input.assignTo?.id ?? null
  let assigneeName: string | null = input.assignTo?.full_name ?? null
  if (!input.assignTo) {
    try {
      const winner = await pickRoundRobinAssignee(supabase, source)
      assignedTo = winner?.id ?? null
      assigneeName = winner?.full_name ?? null
    } catch (e) {
      console.error('ingestLead auto-assign failed, lead will be unassigned:', e)
    }
  }

  const { data: insertedLead, error } = await supabase.from('leads').insert({
    full_name: input.full_name.trim() || 'Lead',
    phone: input.phone,
    email: input.email ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    source,
    status: 'new',
    metadata: input.metadata ?? {},
    assigned_to: assignedTo,
    assigned_at: assignedTo ? new Date().toISOString() : null,
  }).select('id').single()

  if (error) {
    console.error('ingestLead insert error:', error)
    throw new Error(error.message)
  }

  const leadId = (insertedLead as { id: string } | null)?.id ?? null

  // Activity log + targeted notification (best-effort, never blocks the lead)
  if (leadId) {
    try {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: 'created',
        new_value: assigneeName ? `Auto-assigned to ${assigneeName}` : 'new',
      })
      if (assignedTo) {
        await supabase.from('notifications').insert({
          title: 'New Lead assigned',
          message: `${input.full_name.trim()} (${input.phone}) aapko assign hua hai — abhi call karo!`,
          type: 'info',
          target_user_id: assignedTo,
        })
      }
    } catch (e) {
      console.error('ingestLead post-insert (activity/notify) failed:', e)
    }
  }

  return { leadId, assigneeId: assignedTo, assigneeName, duplicate: false }
}

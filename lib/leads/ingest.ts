import type { SupabaseClient } from '@supabase/supabase-js'

export interface IngestLeadInput {
  full_name: string
  phone: string
  email?: string | null
  city?: string | null
  state?: string | null
  source?: string
  /** Who referred this lead (alumni referral form) — kept for incentives. */
  referred_by?: string | null
  referred_by_phone?: string | null
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
  google_ads: 'Google Ads', meta_ads: 'Meta Ads', walk_in: 'Walk-in', ivr: 'IVR call', referral: 'Alumni referral',
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

interface LeadTeam {
  id: string
  name: string
  department_id: string | null
  member_ids: string[]
  forms: string[]
  sources: string[]
  is_default: boolean
}

const norm = (v: string) => v.trim().toLowerCase()

/**
 * The lead team (migration 123) that owns a lead with this form and source:
 * the first active team, in its set order, listing the form or the source;
 * failing that, the default team. Null when there are no teams (or the
 * table isn't there yet) — the lead then goes to everyone, as before.
 */
async function matchLeadTeam(
  supabase: SupabaseClient,
  form: string | undefined,
  source: string
): Promise<LeadTeam | null> {
  const { data, error } = await supabase
    .from('lead_teams')
    .select('id, name, department_id, member_ids, forms, sources, is_default')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at')
  if (error || !data) return null
  const teams = data as LeadTeam[]
  const f = form ? norm(form) : ''
  return teams.find(t =>
    (f && (t.forms ?? []).some(x => norm(x) === f)) || (t.sources ?? []).includes(source)
  ) ?? teams.find(t => t.is_default) ?? null
}

/** The team member with the fewest leads this team routed today (IST). */
async function pickTeamAssignee(
  supabase: SupabaseClient,
  team: LeadTeam
): Promise<{ id: string; full_name: string } | null> {
  if (!team.member_ids?.length) return null
  const { data: agents } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', team.member_ids)
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
    .eq('metadata->>lead_team_id', team.id)
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
 * Who gets a lead nobody named an owner for: the matching team's members
 * if a team claims it, otherwise every active counsellor. A team with no
 * active members falls back to everyone rather than leaving the lead unowned.
 */
async function chooseAssignee(
  supabase: SupabaseClient,
  source: string,
  metadata: Record<string, unknown> | undefined
): Promise<{ winner: { id: string; full_name: string } | null; team: LeadTeam | null }> {
  const form = (metadata as { form?: unknown } | undefined)?.form
  const team = await matchLeadTeam(supabase, typeof form === 'string' ? form : undefined, source)
  if (team) {
    const winner = await pickTeamAssignee(supabase, team)
    if (winner) return { winner, team }
    console.warn(`ingestLead: lead team "${team.name}" has no active members — using everyone`)
  }
  return { winner: await pickRoundRobinAssignee(supabase, source), team: null }
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
      const picked = input.assignTo
        ? { winner: input.assignTo, team: null }
        : await chooseAssignee(supabase, source, input.metadata)
      const winner = picked.winner
      if (winner) {
        assigneeId = winner.id
        assigneeName = winner.full_name
        update.assigned_to = winner.id
        update.assigned_at = now
        if (picked.team) {
          update.metadata = { ...(update.metadata as Record<string, unknown>), lead_team_id: picked.team.id, lead_team: picked.team.name }
        }
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
  // otherwise round-robin inside the lead team that owns this form/source,
  // or across everyone when no team claims it.
  let assignedTo: string | null = input.assignTo?.id ?? null
  let assigneeName: string | null = input.assignTo?.full_name ?? null
  let team: LeadTeam | null = null
  if (!input.assignTo) {
    try {
      const picked = await chooseAssignee(supabase, source, input.metadata)
      assignedTo = picked.winner?.id ?? null
      assigneeName = picked.winner?.full_name ?? null
      team = picked.team
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
    // Only sent when present, so ordinary leads never touch the new columns.
    ...(input.referred_by ? { referred_by: input.referred_by } : {}),
    ...(input.referred_by_phone ? { referred_by_phone: input.referred_by_phone } : {}),
    status: 'new',
    metadata: team
      ? { ...(input.metadata ?? {}), lead_team_id: team.id, lead_team: team.name }
      : (input.metadata ?? {}),
    ...(team?.department_id ? { department_id: team.department_id } : {}),
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
        new_value: assigneeName
          ? `Auto-assigned to ${assigneeName}${team ? ` (${team.name} team)` : ''}`
          : 'new',
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

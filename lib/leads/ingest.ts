import type { SupabaseClient } from '@supabase/supabase-js'

export interface IngestLeadInput {
  full_name: string
  phone: string
  email?: string | null
  city?: string | null
  state?: string | null
  source?: string
  metadata?: Record<string, unknown>
}

export interface IngestLeadResult {
  leadId: string | null
  assigneeId: string | null
  assigneeName: string | null
}

/**
 * Insert an inbound lead (Meta webhook / public form) and distribute it
 * equally among active counselors via round-robin (fewest leads today from
 * this same source win), then notify the assignee in-app.
 *
 * Requires a SERVICE-ROLE supabase client (bypasses RLS, runs server-side only).
 */
export async function ingestLead(
  supabase: SupabaseClient,
  input: IngestLeadInput
): Promise<IngestLeadResult> {
  const source = input.source || 'meta_ads'

  // ── Auto-assign: pick the active counselor with the fewest leads from this
  // source today (IST), so incoming leads round-robin evenly across the team.
  let assignedTo: string | null = null
  let assigneeName: string | null = null
  try {
    const { data: agents } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['lead', 'telecaller', 'counselor'])
      .eq('is_active', true)
      .order('id')

    if (agents && agents.length > 0) {
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
      const winner = agents.reduce((best: { id: string; full_name: string }, a: { id: string; full_name: string }) =>
        (counts.get(a.id) ?? 0) < (counts.get(best.id) ?? 0) ? a : best
      )
      assignedTo = winner.id
      assigneeName = winner.full_name
    }
  } catch (e) {
    console.error('ingestLead auto-assign failed, lead will be unassigned:', e)
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

  return { leadId, assigneeId: assignedTo, assigneeName }
}

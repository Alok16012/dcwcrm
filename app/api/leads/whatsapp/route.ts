import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAgentRequest } from '@/lib/biometric/auth'
import { ingestLead } from '@/lib/leads/ingest'

/**
 * Lead intake for the WhatsApp admission bot (whatsapp-bot/, on Railway).
 *
 * Three actions, because a chat builds a lead up over many messages:
 *
 *   ensure   once per conversation — through ingestLead, so dedupe by phone,
 *            round-robin assignment and the repeat-enquiry nudge all behave
 *            exactly as they do for Meta and IVR leads.
 *   update   after each answer — merges the bot's fields into metadata and
 *            nothing else. No notification: a counsellor pinged on every
 *            reply would mute the channel.
 *   handoff  when the bot is done — the summary line goes on the lead's
 *            timeline and the owner is told to call.
 *
 * Fields arrive flat ("Class": "12th") because the lead page renders metadata
 * key by key; nesting would show a counsellor "[object Object]".
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  action?: 'ensure' | 'update' | 'handoff'
  lead_id?: string
  phone?: string
  push_name?: string
  department?: string
  fields?: Record<string, string>
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  ) as any
}

/** Department ids by name, looked up once per request. */
async function departmentId(db: any, name?: string): Promise<string | null> {
  if (!name) return null
  const { data } = await db.from('departments').select('id').ilike('name', name).maybeSingle()
  return data?.id ?? null
}

/**
 * Merge the bot's fields into a lead without disturbing anything else there —
 * a Meta form's answers on the same lead stay exactly as they were. The
 * department is only set if nobody has set one yet.
 */
async function mergeIntoLead(db: any, leadId: string, fields: Record<string, string>, department?: string) {
  const { data: lead } = await db
    .from('leads').select('metadata, department_id').eq('id', leadId).maybeSingle()
  if (!lead) return false

  const update: Record<string, unknown> = {
    // whatsapp_bot marks every lead the bot talked to, including ones that
    // already existed from IVR or Meta and so keep their original source —
    // it is what the Leads page's WhatsApp filter and badge read.
    metadata: {
      ...(lead.metadata ?? {}), ...fields,
      whatsapp_bot: 'yes',
      'Bot Updated': new Date().toISOString().slice(0, 16).replace('T', ' '),
    },
    updated_at: new Date().toISOString(),
  }
  if (!lead.department_id) {
    const dep = await departmentId(db, department)
    if (dep) update.department_id = dep
  }
  const { error } = await db.from('leads').update(update).eq('id', leadId)
  return !error
}

export async function POST(req: Request) {
  const raw = await req.text()
  const auth = verifyAgentRequest(req, raw, process.env.WHATSAPP_BOT_SECRET, 'WHATSAPP_BOT_SECRET')
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status })

  let body: Body
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const db = admin()
  const fields = body.fields ?? {}

  // ------------------------------------------------------------ ensure ---
  if (body.action === 'ensure') {
    const phone = String(body.phone ?? '').replace(/\D/g, '')
    if (phone.length < 10) {
      return NextResponse.json({ error: 'A phone number is required to create a lead' }, { status: 400 })
    }

    const result = await ingestLead(db, {
      full_name: body.push_name?.trim() || 'WhatsApp Lead',
      phone: phone.slice(-10),
      city: fields['City/State']?.split(',')[0]?.trim() || fields['City']?.trim() || null,
      source: 'whatsapp',
      metadata: { form: 'WhatsApp Chatbot', lead_source: 'WhatsApp' },
    })
    if (!result.leadId) return NextResponse.json({ error: 'Lead could not be created' }, { status: 500 })

    await mergeIntoLead(db, result.leadId, fields, body.department)

    // An existing lead often has only a placeholder name ("IVR Caller 98…");
    // the student's WhatsApp name is better than that, never better than a real one.
    const pushName = body.push_name?.trim()
    if (result.duplicate && pushName) {
      await db.from('leads').update({ full_name: pushName })
        .eq('id', result.leadId)
        .or('full_name.ilike.IVR Caller%,full_name.eq.WhatsApp Lead')
    }
    return NextResponse.json({ ok: true, lead_id: result.leadId, duplicate: result.duplicate, assignee: result.assigneeName })
  }

  if (!body.lead_id) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })

  // ------------------------------------------------------------ update ---
  if (body.action === 'update') {
    const ok = await mergeIntoLead(db, body.lead_id, fields, body.department)
    return NextResponse.json({ ok })
  }

  // ----------------------------------------------------------- handoff ---
  if (body.action === 'handoff') {
    await mergeIntoLead(db, body.lead_id, fields, body.department)

    const summary = fields['Bot Summary'] ?? 'WhatsApp bot conversation complete'
    const temp = fields['Lead Temperature'] ?? ''
    await db.from('lead_activities').insert({
      lead_id: body.lead_id,
      activity_type: 'note_added',
      new_value: `WhatsApp bot${temp ? ` (${temp})` : ''}: ${summary}`,
    })

    const { data: lead } = await db
      .from('leads').select('full_name, phone, assigned_to').eq('id', body.lead_id).maybeSingle()
    if (lead?.assigned_to) {
      await db.from('notifications').insert({
        title: temp === 'Hot' ? '🔥 Hot WhatsApp lead — call now' : 'WhatsApp lead ready for a call',
        message: `${lead.full_name} (${lead.phone}): ${summary}`.slice(0, 480),
        type: 'info',
        target_user_id: lead.assigned_to,
      })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

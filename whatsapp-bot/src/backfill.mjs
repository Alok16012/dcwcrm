/**
 * Give every WhatsApp chat that never got a CRM lead one now.
 *
 * Chats from before the bot created a lead on the first message — a bare
 * "Hi", or a chat the bot stayed silent in — never reached the Leads table,
 * and a CRM outage can leave a chat unlinked too. Each goes through the same
 * /api/leads/whatsapp ingest the bot uses, so dedupe by phone and round-robin
 * assignment behave as usual. Only chats with no lead_id are touched, so
 * running it again is harmless.
 */

import { leadFields } from './lead.mjs'
import { FLOWS } from './flows/index.mjs'

export async function backfillLeads({ db, crm, log, apply = true }) {
  const { data: rows, error } = await db
    .from('wa_conversations')
    .select('id, chat_jid, phone, push_name, state')
    .is('lead_id', null)
    .order('created_at')
  if (error) throw new Error(error.message)

  const todo = rows.filter(r => r.phone)
  const skipped = rows.length - todo.length
  log.info(`backfill: ${todo.length} chat(s) without a lead${skipped ? `, ${skipped} more skipped (phone not resolved yet)` : ''}`)

  let ok = 0
  for (const r of todo) {
    const state = r.state ?? {}
    const flow = FLOWS[state.flow]
    const fields = flow ? leadFields(state) : { 'Chatbot Flow': 'Not chosen yet' }
    const department = flow ? flow.department(state.answers ?? {}) : undefined
    if (!apply) { log.info(`  ${r.phone}  ${r.push_name ?? ''}`); continue }
    try {
      const res = await crm.ensure({ phone: r.phone, pushName: r.push_name, fields, department })
      await db.from('wa_conversations').update({ lead_id: res.lead_id }).eq('id', r.id)
      log.info(`  ${r.phone}  ${res.duplicate ? 'matched' : 'created'} ${res.lead_id}${res.assignee ? ` → ${res.assignee}` : ''}`)
      ok++
    } catch (e) {
      log.error(`  ${r.phone}  FAILED: ${e.message}`)
    }
  }
  return { total: todo.length, ok }
}

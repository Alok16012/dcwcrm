#!/usr/bin/env node
/**
 * One-off: give every WhatsApp chat that never got a CRM lead one now.
 *
 * Before the bot created a lead on the first message, chats where the
 * student only said "Hi", or where the bot stayed silent (paused, counsellor
 * took over, message too old), never reached the Leads table. This sends each
 * of them through the same /api/leads/whatsapp ingest the bot uses, so dedupe
 * by phone and round-robin assignment behave as usual.
 *
 *   node scripts/backfill-leads.mjs           # dry run — lists the chats
 *   node scripts/backfill-leads.mjs --apply   # creates / links the leads
 *
 * Needs the bot's env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * CRM_BASE_URL, WHATSAPP_BOT_SECRET.
 */

import { createClient } from '@supabase/supabase-js'
import { makeCrm } from '../src/crm.mjs'
import { leadFields } from '../src/lead.mjs'
import { FLOWS } from '../src/flows/index.mjs'

const apply = process.argv.includes('--apply')
const env = process.env
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CRM_BASE_URL', 'WHATSAPP_BOT_SECRET']) {
  if (!env[k]) { console.error(`${k} is not set`); process.exit(1) }
}

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const crm = makeCrm({ baseUrl: env.CRM_BASE_URL, secret: env.WHATSAPP_BOT_SECRET })

const { data: rows, error } = await db
  .from('wa_conversations')
  .select('id, chat_jid, phone, push_name, state')
  .is('lead_id', null)
  .order('created_at')
if (error) { console.error(error.message); process.exit(1) }

const noPhone = rows.filter(r => !r.phone)
const todo = rows.filter(r => r.phone)
console.log(`${todo.length} chat(s) without a lead${noPhone.length ? `, ${noPhone.length} more skipped (phone not resolved yet)` : ''}`)

let ok = 0
for (const r of todo) {
  const state = r.state ?? {}
  const flow = FLOWS[state.flow]
  const fields = flow ? leadFields(state) : { 'Chatbot Flow': 'Not chosen yet' }
  const department = flow ? flow.department(state.answers ?? {}) : undefined
  if (!apply) { console.log(`  ${r.phone}  ${r.push_name ?? ''}`); continue }
  try {
    const res = await crm.ensure({ phone: r.phone, pushName: r.push_name, fields, department })
    await db.from('wa_conversations').update({ lead_id: res.lead_id }).eq('id', r.id)
    console.log(`  ${r.phone}  ${res.duplicate ? 'matched' : 'created'} ${res.lead_id}${res.assignee ? ` → ${res.assignee}` : ''}`)
    ok++
  } catch (e) {
    console.error(`  ${r.phone}  FAILED: ${e.message}`)
  }
}
if (apply) console.log(`done: ${ok}/${todo.length}`)
else console.log('dry run — re-run with --apply to create the leads')

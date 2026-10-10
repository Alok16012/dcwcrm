#!/usr/bin/env node
/**
 * Run the lead backfill by hand (the bot also runs it on every start).
 *
 *   node scripts/backfill-leads.mjs           # dry run — lists the chats
 *   node scripts/backfill-leads.mjs --apply   # creates / links the leads
 *
 * Needs the bot's env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * CRM_BASE_URL, WHATSAPP_BOT_SECRET.
 */

import { createClient } from '@supabase/supabase-js'
import { makeCrm } from '../src/crm.mjs'
import { backfillLeads } from '../src/backfill.mjs'

const apply = process.argv.includes('--apply')
const env = process.env
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CRM_BASE_URL', 'WHATSAPP_BOT_SECRET']) {
  if (!env[k]) { console.error(`${k} is not set`); process.exit(1) }
}

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const crm = makeCrm({ baseUrl: env.CRM_BASE_URL, secret: env.WHATSAPP_BOT_SECRET })
const log = { info: console.log, error: console.error }

const { total, ok } = await backfillLeads({ db, crm, log, apply })
console.log(apply ? `done: ${ok}/${total}` : 'dry run — re-run with --apply to create the leads')

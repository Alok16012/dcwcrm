#!/usr/bin/env node
/**
 * DCW WhatsApp admission bot — the worker for ONE WhatsApp number.
 *
 * Holds that number's WhatsApp connection, answers its students and keeps the
 * CRM current. src/manager.mjs starts one of these per active row in
 * wa_accounts (migration 126) with ACCOUNT_ID set, and restarts it if it
 * dies; each number has its own login folder, status row, chats, flows,
 * admission script, settings and outreach. See README.md for setup.
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { makeWhatsApp } from './whatsapp.mjs'
import { makeStore } from './store.mjs'
import { makeCrm } from './crm.mjs'
import { makeBot } from './bot.mjs'
import { aiStats } from './ai.mjs'
import { makeControl } from './control.mjs'
import { backfillLeads } from './backfill.mjs'

const env = process.env
const ACCOUNT_ID = env.ACCOUNT_ID
const tag = `[${env.ACCOUNT_LABEL ?? ACCOUNT_ID?.slice(0, 8) ?? 'bot'}]`
const log = {
  info: (...a) => console.log(new Date().toISOString(), tag, ...a),
  warn: (...a) => console.warn(new Date().toISOString(), tag, 'WARN', ...a),
  error: (...a) => console.error(new Date().toISOString(), tag, 'ERROR', ...a),
}
if (!ACCOUNT_ID) {
  log.error('ACCOUNT_ID is not set — start the bot with `npm start` (src/manager.mjs), which runs one worker per number')
  process.exit(1)
}
// Running under the manager: it serves the health check and gets our status over IPC.
const underManager = typeof process.send === 'function'

function required(name) {
  if (!env[name]) {
    log.error(`${name} is not set`)
    process.exit(1)
  }
  return env[name]
}

const config = {
  counselorPhone: env.COUNSELOR_PHONE ?? '',
  // Emergency brake: connected and recording, but silent.
  paused: env.BOT_PAUSED === 'true',
}

// Each number keeps its own linked-device login.
const authBase = env.WA_AUTH_DIR ?? (fs.existsSync('/data') ? '/data/wa-auth' : './.wa-auth')
const authDir = path.join(authBase, ACCOUNT_ID)
fs.mkdirSync(authDir, { recursive: true })

const db = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
})
const store = makeStore(db, ACCOUNT_ID)
const crm = makeCrm({ baseUrl: required('CRM_BASE_URL'), secret: required('WHATSAPP_BOT_SECRET') })

// The number to link by pairing code, if admin gave one for this account.
const { data: account } = await db.from('wa_accounts').select('label, phone').eq('id', ACCOUNT_ID).maybeSingle()

/**
 * Mirror the connection state into this number's wa_accounts row for the
 * CRM's WhatsApp page. Best effort: a failed write must never stop the bot
 * from answering.
 */
async function reportStatus(patch) {
  const now = new Date().toISOString()
  const { error } = await db.from('wa_accounts').update({
    ...patch,
    ai_provider: aiStats().provider,
    ai_used_today: aiStats().usedToday,
    heartbeat_at: now,
    updated_at: now,
  }).eq('id', ACCOUNT_ID)
  if (error) log.warn(`status report failed: ${error.message}`)
  if (underManager && patch.status) process.send?.({ type: 'status', status: patch.status })
}

let bot
const wa = makeWhatsApp({
  authDir,
  phoneNumber: account?.phone || env.WA_PHONE_NUMBER,
  log,
  onMessage: (m, meta) => bot.onMessage(m, meta),
  onStatus: patch => reportStatus(patch),
})

// A heartbeat, so the CRM can tell "connected" from "the process died while
// the last row still said connected".
setInterval(() => reportStatus({ status: wa.status }), 60 * 1000)
// "Unlink / link another number" from the CRM: it stamps relink_requested_at
// and the bot picks that up here. Cleared before acting so it runs once.
let relinking = false
setInterval(async () => {
  if (relinking) return
  const { data, error } = await db.from('wa_accounts').select('relink_requested_at').eq('id', ACCOUNT_ID).maybeSingle()
  if (error || !data?.relink_requested_at) return
  relinking = true
  try {
    await db.from('wa_accounts').update({ relink_requested_at: null }).eq('id', ACCOUNT_ID)
    await wa.relink()
  } catch (e) {
    log.error(`relink failed: ${e.message}`)
  } finally {
    relinking = false
  }
}, 10 * 1000)
// Settings, knowledge and outreach from the CRM's control centre. BOT_PAUSED
// on Railway still wins: it is the brake that works even if the CRM is down.
const control = makeControl({ db, wa, store, config, envPaused: config.paused, log, accountId: ACCOUNT_ID })
bot = makeBot({ wa, store, crm, config, log, onStudentMessage: phone => control.noteReply(phone) })
control.start()

// Link any chat that never got a lead (older chats, or a CRM outage). Off the
// startup path: it must not hold up connecting to WhatsApp.
setTimeout(() => {
  backfillLeads({ db, crm, log, accountId: ACCOUNT_ID })
    .then(({ total, ok }) => total && log.info(`backfill: ${ok}/${total} chat(s) linked to a lead`))
    .catch(e => log.error(`backfill: ${e.message}`))
}, 30 * 1000)

// Health: what Railway (and a person) can check without reading logs. No
// secrets, no pairing code — those only ever go to the log.
const port = Number(env.PORT ?? 8080)
if (!underManager) http.createServer((req, res) => {
  const body = {
    whatsapp: wa.status,
    paused: config.paused,
    ai: aiStats(),
    control: control.stats(),
    uptimeSeconds: Math.round(process.uptime()),
  }
  // /health is liveness only — 200 whenever the process is up. It must NOT
  // depend on WhatsApp being connected: on a first deploy the bot is waiting
  // to be paired, and a failing healthcheck would make Railway restart it,
  // which issues a fresh pairing code each time — pairing would never finish.
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify(body))
  }
  // /ready is the honest answer to "is it answering students right now?".
  if (req.url === '/ready') {
    res.writeHead(wa.status === 'connected' ? 200 : 503, { 'content-type': 'application/json' })
    return res.end(JSON.stringify(body))
  }
  res.writeHead(404).end()
}).listen(port, () => log.info(`health on :${port}/health`))

log.info(`DCW WhatsApp bot (${account?.label ?? ACCOUNT_ID}) — auth in ${authDir}, AI: ${aiStats().provider}${config.paused ? ' — PAUSED' : ''}`)
wa.connect().catch(e => {
  log.error(`could not start WhatsApp: ${e.stack ?? e.message}`)
  process.exit(1)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log.info(`${sig} — shutting down`)
    // Do not logout(): that would unlink the device and force a re-pair on
    // every deploy. Just close the socket.
    try { wa.sock?.end(undefined) } catch { /* already closed */ }
    setTimeout(() => process.exit(0), 500)
  })
}
process.on('unhandledRejection', e => log.error('unhandled rejection:', e?.stack ?? e))

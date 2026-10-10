#!/usr/bin/env node
/**
 * DCW WhatsApp admission bot.
 *
 * One long-running process: holds the WhatsApp connection, answers students,
 * and keeps the CRM current. Runs on Railway as its own service (a serverless
 * host cannot hold a socket open). See README.md for setup.
 */

import http from 'node:http'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { makeWhatsApp } from './whatsapp.mjs'
import { makeStore } from './store.mjs'
import { makeCrm } from './crm.mjs'
import { makeBot } from './bot.mjs'
import { aiStats } from './ai.mjs'
import { makeControl } from './control.mjs'
import { backfillLeads } from './backfill.mjs'

const env = process.env
const log = {
  info: (...a) => console.log(new Date().toISOString(), ...a),
  warn: (...a) => console.warn(new Date().toISOString(), 'WARN', ...a),
  error: (...a) => console.error(new Date().toISOString(), 'ERROR', ...a),
}

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

const authDir = env.WA_AUTH_DIR ?? (fs.existsSync('/data') ? '/data/wa-auth' : './.wa-auth')
fs.mkdirSync(authDir, { recursive: true })

const db = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
})
const store = makeStore(db)
const crm = makeCrm({ baseUrl: required('CRM_BASE_URL'), secret: required('WHATSAPP_BOT_SECRET') })

/**
 * Mirror the connection state into wa_bot_status for the CRM's WhatsApp page.
 * Best effort: a failed write must never stop the bot from answering.
 */
async function reportStatus(patch) {
  const { error } = await db.from('wa_bot_status').upsert({
    id: true,
    ...patch,
    ai_provider: aiStats().provider,
    ai_used_today: aiStats().usedToday,
    updated_at: new Date().toISOString(),
  })
  if (error) log.warn(`status report failed: ${error.message}`)
}

let bot
const wa = makeWhatsApp({
  authDir,
  phoneNumber: env.WA_PHONE_NUMBER,
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
  const { data, error } = await db.from('wa_bot_status').select('relink_requested_at').maybeSingle()
  if (error || !data?.relink_requested_at) return
  relinking = true
  try {
    await db.from('wa_bot_status').update({ relink_requested_at: null }).eq('id', true)
    await wa.relink()
  } catch (e) {
    log.error(`relink failed: ${e.message}`)
  } finally {
    relinking = false
  }
}, 10 * 1000)
// Settings, knowledge and outreach from the CRM's control centre. BOT_PAUSED
// on Railway still wins: it is the brake that works even if the CRM is down.
const control = makeControl({ db, wa, store, config, envPaused: config.paused, log })
bot = makeBot({ wa, store, crm, config, log, onStudentMessage: phone => control.noteReply(phone) })
control.start()

// Link any chat that never got a lead (older chats, or a CRM outage). Off the
// startup path: it must not hold up connecting to WhatsApp.
setTimeout(() => {
  backfillLeads({ db, crm, log })
    .then(({ total, ok }) => total && log.info(`backfill: ${ok}/${total} chat(s) linked to a lead`))
    .catch(e => log.error(`backfill: ${e.message}`))
}, 30 * 1000)

// Health: what Railway (and a person) can check without reading logs. No
// secrets, no pairing code — those only ever go to the log.
const port = Number(env.PORT ?? 8080)
http.createServer((req, res) => {
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

log.info(`DCW WhatsApp bot — auth in ${authDir}, AI: ${aiStats().provider}${config.paused ? ' — PAUSED' : ''}`)
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

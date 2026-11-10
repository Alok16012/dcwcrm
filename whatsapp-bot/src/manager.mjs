#!/usr/bin/env node
/**
 * Runs the bot for every WhatsApp number at once.
 *
 * Each active row in wa_accounts (migration 126) gets its own worker process
 * (src/index.mjs with ACCOUNT_ID set). A worker per number keeps each number's
 * admission script and settings apart — the engine holds those in module
 * state — and one number crashing or being re-linked never touches another.
 *
 * Every 15 s this re-reads wa_accounts: a number added in the CRM starts, one
 * switched off or deleted stops, and a worker that dies is restarted with a
 * growing delay. It also serves the health check for the whole service.
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const env = process.env
const log = {
  info: (...a) => console.log(new Date().toISOString(), '[manager]', ...a),
  warn: (...a) => console.warn(new Date().toISOString(), '[manager] WARN', ...a),
  error: (...a) => console.error(new Date().toISOString(), '[manager] ERROR', ...a),
}

for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CRM_BASE_URL', 'WHATSAPP_BOT_SECRET']) {
  if (!env[name]) { log.error(`${name} is not set`); process.exit(1) }
}

const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.mjs')
const POLL_MS = 15 * 1000
/** "Number 1" — the account everything before migration 126 belongs to. */
const FIRST_ACCOUNT = '00000000-0000-0000-0000-000000000001'

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Before several numbers, the single login lived straight in the auth folder.
// Move it into Number 1's folder once, so that number stays linked.
const authBase = env.WA_AUTH_DIR ?? (fs.existsSync('/data') ? '/data/wa-auth' : './.wa-auth')
fs.mkdirSync(authBase, { recursive: true })
const firstDir = path.join(authBase, FIRST_ACCOUNT)
if (fs.existsSync(path.join(authBase, 'creds.json')) && !fs.existsSync(path.join(firstDir, 'creds.json'))) {
  fs.mkdirSync(firstDir, { recursive: true })
  for (const f of fs.readdirSync(authBase)) {
    const from = path.join(authBase, f)
    if (fs.statSync(from).isFile()) fs.renameSync(from, path.join(firstDir, f))
  }
  log.info(`moved the existing WhatsApp login into Number 1's folder`)
}

/** accountId → { label, child, status, restarts, startedAt, wanted, retryAt } */
const workers = new Map()
let stopping = false

function start(id, label) {
  const w = workers.get(id) ?? { restarts: 0 }
  w.label = label
  w.wanted = true
  w.status = 'starting'
  w.startedAt = Date.now()
  w.retryAt = 0
  w.child = fork(WORKER, [], { env: { ...env, ACCOUNT_ID: id, ACCOUNT_LABEL: label } })
  w.child.on('message', m => { if (m?.type === 'status') w.status = m.status })
  w.child.on('exit', (code, signal) => {
    w.child = null
    w.status = 'stopped'
    if (stopping || !w.wanted) return
    // Restart, backing off if it keeps dying; a worker that ran a while starts fresh.
    if (Date.now() - w.startedAt > 5 * 60 * 1000) w.restarts = 0
    const delay = Math.min(60, 5 * 2 ** w.restarts) * 1000
    w.restarts++
    w.retryAt = Date.now() + delay
    log.warn(`${label}: worker exited (${signal ?? code}) — restarting in ${delay / 1000}s`)
  })
  workers.set(id, w)
  log.info(`${label}: worker started (pid ${w.child.pid})`)
}

function stop(id, why) {
  const w = workers.get(id)
  if (!w) return
  w.wanted = false
  if (w.child) {
    log.info(`${w.label}: stopping (${why})`)
    w.child.kill('SIGTERM')
  }
  workers.delete(id)
}

async function sync() {
  const { data, error } = await db.from('wa_accounts').select('id, label, is_active').order('sort_order').order('created_at')
  if (error) {
    log.error(`cannot read wa_accounts (${error.message}) — has migration 126 been run? Retrying.`)
    return
  }
  const active = new Map((data ?? []).filter(a => a.is_active).map(a => [a.id, a.label]))
  for (const id of [...workers.keys()]) {
    if (!active.has(id)) stop(id, 'switched off or removed in the CRM')
  }
  for (const [id, label] of active) {
    const w = workers.get(id)
    if (!w) start(id, label)
    else if (!w.child && Date.now() >= (w.retryAt ?? 0)) start(id, label)
    else if (w.label !== label) w.label = label
  }
}

sync().catch(e => log.error(`sync: ${e.message}`))
setInterval(() => sync().catch(e => log.error(`sync: ${e.message}`)), POLL_MS)

// Health for the whole service: liveness always 200 while the manager is up
// (a number waiting to be paired must not get the process restarted);
// /ready only when every number is connected.
const port = Number(env.PORT ?? 8080)
http.createServer((req, res) => {
  const numbers = [...workers.values()].map(w => ({
    label: w.label, whatsapp: w.status, running: Boolean(w.child), restarts: w.restarts,
  }))
  const body = { numbers, uptimeSeconds: Math.round(process.uptime()) }
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify(body))
  }
  if (req.url === '/ready') {
    const ok = numbers.length > 0 && numbers.every(n => n.whatsapp === 'connected')
    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' })
    return res.end(JSON.stringify(body))
  }
  res.writeHead(404).end()
// HEALTH_HOST=127.0.0.1 on a shared server keeps the status page off the internet.
}).listen(port, env.HEALTH_HOST || undefined, () => log.info(`health on ${env.HEALTH_HOST ?? ''}:${port}/health`))

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stopping = true
    log.info(`${sig} — stopping ${workers.size} worker(s)`)
    for (const w of workers.values()) w.child?.kill('SIGTERM')
    setTimeout(() => process.exit(0), 2000)
  })
}
process.on('unhandledRejection', e => log.error('unhandled rejection:', e?.stack ?? e))

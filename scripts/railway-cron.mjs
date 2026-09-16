#!/usr/bin/env node
/**
 * Cron entrypoint for Railway.
 *
 * Railway runs a cron service as a one-shot container rather than calling a URL
 * the way Vercel's crons do, so this script simply invokes the app's own cron
 * routes with the shared secret and exits. Point a cron service at:
 *
 *   node scripts/railway-cron.mjs auto-punchout
 *   node scripts/railway-cron.mjs biometric-sync
 *
 * With no argument it runs every job in order.
 */

const JOBS = {
  'auto-punchout': '/api/cron/auto-punchout',
  'biometric-sync': '/api/cron/biometric-sync',
}

const base = (process.env.CRON_TARGET_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
const secret = process.env.CRON_SECRET

if (!base) {
  console.error('Set CRON_TARGET_URL to the deployed app URL, e.g. https://dcwcrm.up.railway.app')
  process.exit(1)
}

const requested = process.argv[2]
const jobs = requested ? [requested] : Object.keys(JOBS)

let failed = false

for (const job of jobs) {
  const path = JOBS[job]
  if (!path) {
    console.error(`Unknown job "${job}". Known: ${Object.keys(JOBS).join(', ')}`)
    failed = true
    continue
  }

  try {
    const res = await fetch(`${base}${path}`, {
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
      signal: AbortSignal.timeout(120000),
    })
    const text = await res.text()
    console.log(`${job} -> ${res.status} ${text.slice(0, 500)}`)
    if (!res.ok) failed = true
  } catch (e) {
    console.error(`${job} -> failed:`, e.message)
    failed = true
  }
}

process.exit(failed ? 1 : 0)

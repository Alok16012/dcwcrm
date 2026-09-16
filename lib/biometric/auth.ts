/**
 * Authentication for the LAN bridge agent.
 *
 * The agent lives in the office, outside our control plane, so its requests are
 * signed rather than session-authenticated: HMAC-SHA256 over the exact request
 * body plus a timestamp. The timestamp bounds replay, and comparing digests in
 * constant time keeps the secret out of reach of timing probes.
 */

import { createHmac, timingSafeEqual } from 'crypto'

const MAX_SKEW_SECONDS = Number(process.env.BIOMETRIC_MAX_SKEW_SECONDS ?? 300)

export type AuthResult = { ok: true } | { ok: false; reason: string; status: number }

export function sign(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Verify a signed agent request. Falls back to a plain bearer token when
 * BIOMETRIC_ALLOW_BEARER is set — useful while commissioning a device, but the
 * signed path is what should run in production.
 */
export function verifyAgentRequest(req: Request, rawBody: string): AuthResult {
  const secret = process.env.BIOMETRIC_WEBHOOK_SECRET
  if (!secret) {
    return { ok: false, reason: 'BIOMETRIC_WEBHOOK_SECRET is not configured', status: 500 }
  }

  const signature = req.headers.get('x-dcw-signature')
  const timestamp = req.headers.get('x-dcw-timestamp')

  if (!signature || !timestamp) {
    if (process.env.BIOMETRIC_ALLOW_BEARER === 'true') {
      const auth = req.headers.get('authorization') ?? ''
      if (auth === `Bearer ${secret}`) return { ok: true }
    }
    return { ok: false, reason: 'Missing signature', status: 401 }
  }

  const skew = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) {
    return { ok: false, reason: 'Stale or invalid timestamp', status: 401 }
  }

  const expected = sign(secret, timestamp, rawBody)
  const provided = signature.replace(/^sha256=/, '')
  if (!safeEqual(expected, provided)) {
    return { ok: false, reason: 'Bad signature', status: 401 }
  }

  return { ok: true }
}

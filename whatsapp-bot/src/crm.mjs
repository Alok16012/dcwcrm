/**
 * Talking to the CRM. Leads are created through the CRM's own ingest path
 * (/api/leads/whatsapp) rather than written here, so dedupe, assignment and
 * notifications stay in one place for every lead source.
 */

import { createHmac } from 'node:crypto'

export function makeCrm({ baseUrl, secret }) {
  const base = String(baseUrl ?? '').replace(/\/+$/, '')

  async function post(payload) {
    if (!base || !secret) throw new Error('CRM_BASE_URL / WHATSAPP_BOT_SECRET not configured')
    const body = JSON.stringify(payload)
    const ts = Math.floor(Date.now() / 1000).toString()
    const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
    const res = await fetch(`${base}/api/leads/whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dcw-timestamp': ts, 'x-dcw-signature': `sha256=${sig}` },
      body,
      signal: AbortSignal.timeout(20000),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`CRM ${payload.action} → ${res.status}: ${text.slice(0, 200)}`)
    return JSON.parse(text)
  }

  return {
    ensure: ({ phone, pushName, fields, department }) =>
      post({ action: 'ensure', phone, push_name: pushName, fields, department }),
    update: ({ leadId, fields, department }) =>
      post({ action: 'update', lead_id: leadId, fields, department }),
    handoff: ({ leadId, fields, department }) =>
      post({ action: 'handoff', lead_id: leadId, fields, department }),
  }
}

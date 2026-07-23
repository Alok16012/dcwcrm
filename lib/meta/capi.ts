import crypto from 'crypto'

// Meta Conversions API — server-side "Lead" event.
// Needs env vars:
//   NEXT_PUBLIC_META_PIXEL_ID  — Pixel ID from Events Manager
//   META_CAPI_ACCESS_TOKEN     — Events Manager > Settings > Conversions API > Generate token

const GRAPH_VERSION = 'v21.0'

function sha256(v: string) {
  return crypto.createHash('sha256').update(v).digest('hex')
}

// Meta requires normalization before hashing (lowercase, trimmed; phone in E.164 digits)
export function hashEmail(email?: string | null): string | null {
  const e = (email ?? '').trim().toLowerCase()
  return e ? sha256(e) : null
}

export function hashPhone(phone?: string | null): string | null {
  let digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) digits = '91' + digits
  else if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1)
  return sha256(digits)
}

export interface CapiLeadInput {
  eventId: string
  email?: string | null
  phone?: string | null
  firstName?: string | null
  sourceUrl?: string | null
  clientIp?: string | null
  userAgent?: string | null
  fbp?: string | null
  fbc?: string | null
}

// Fire-and-report: returns true if Meta accepted the event. Never throws.
export async function sendLeadToMeta(input: CapiLeadInput): Promise<boolean> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const token = process.env.META_CAPI_ACCESS_TOKEN
  if (!pixelId || !token) return false

  const userData: Record<string, unknown> = {}
  const em = hashEmail(input.email)
  const ph = hashPhone(input.phone)
  const fn = (input.firstName ?? '').trim().toLowerCase().split(/\s+/)[0]
  if (em) userData.em = [em]
  if (ph) userData.ph = [ph]
  if (fn) userData.fn = [sha256(fn)]
  if (input.clientIp) userData.client_ip_address = input.clientIp
  if (input.userAgent) userData.client_user_agent = input.userAgent
  if (input.fbp) userData.fbp = input.fbp
  if (input.fbc) userData.fbc = input.fbc

  const payload = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      action_source: 'website',
      event_source_url: input.sourceUrl ?? undefined,
      user_data: userData,
      custom_data: {
        event_source: 'crm',
        lead_event_source: 'DCW CRM',
      },
    }],
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      console.error('Meta CAPI error:', res.status, err.slice(0, 300))
      return false
    }
    return true
  } catch (e) {
    console.error('Meta CAPI request failed:', e)
    return false
  }
}

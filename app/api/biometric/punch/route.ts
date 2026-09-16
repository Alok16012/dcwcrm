import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAgentRequest } from '@/lib/biometric/auth'
import { ingestPunches, type RawPunchInput } from '@/lib/biometric/ingest'

/**
 * Punch intake from the Dahua bridge agent.
 *
 * The agent posts either a single event (live stream) or a batch (catch-up
 * replay). Both shapes land here; the ingest layer dedupes, so the agent is
 * free to retry a delivery it isn't sure about.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PunchBody {
  device_serial?: string
  device_name?: string
  device_ip?: string
  source?: 'agent' | 'poll'
  punches?: RawPunchInput[]
  // Single-event convenience form.
  user_id?: string
  card_no?: string
  card_name?: string
  timestamp?: string | number
  method?: number
  direction?: string
  door?: number
  status?: number | string
  error_code?: number
  event_code?: string
  rec_no?: number
}

export async function POST(req: Request) {
  // Read the body as text first: the signature covers the exact bytes sent.
  const rawBody = await req.text()

  const auth = verifyAgentRequest(req, rawBody)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status })
  }

  let body: PunchBody
  try {
    body = JSON.parse(rawBody) as PunchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const punches: RawPunchInput[] = Array.isArray(body.punches)
    ? body.punches
    : body.timestamp != null
      ? [
          {
            userId: body.user_id,
            cardNo: body.card_no,
            cardName: body.card_name,
            timestamp: body.timestamp,
            method: body.method,
            direction: body.direction,
            door: body.door,
            status: body.status,
            errorCode: body.error_code,
            eventCode: body.event_code,
            recNo: body.rec_no,
            raw: body,
          },
        ]
      : []

  if (punches.length === 0) {
    return NextResponse.json({ error: 'No punches in payload' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const result = await ingestPunches(supabase, punches, {
    deviceSerial: body.device_serial ?? null,
    deviceName: body.device_name ?? null,
    deviceIp: body.device_ip ?? null,
    source: body.source ?? 'agent',
  })

  if (result.errors.length > 0) {
    console.error('biometric punch ingest errors', result.errors)
  }

  return NextResponse.json(result)
}

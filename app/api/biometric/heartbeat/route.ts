import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAgentRequest } from '@/lib/biometric/auth'
import { resolveDevice } from '@/lib/biometric/ingest'

/**
 * Liveness ping from the bridge agent, every minute or so.
 *
 * Without it a dead agent is indistinguishable from a quiet office — nobody
 * punches after 7 PM either. last_seen_at is what the HRMS screen uses to show
 * the device as online.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const rawBody = await req.text()

  const auth = verifyAgentRequest(req, rawBody)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status })
  }

  let body: {
    device_serial?: string
    device_name?: string
    device_ip?: string
    agent_version?: string
    device_online?: boolean
  }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.device_serial) {
    return NextResponse.json({ error: 'device_serial is required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const device = await resolveDevice(supabase, {
    deviceSerial: body.device_serial,
    deviceName: body.device_name,
    deviceIp: body.device_ip,
  })

  if (!device) {
    return NextResponse.json({ error: 'Could not register device' }, { status: 500 })
  }

  await supabase
    .from('biometric_devices')
    .update({
      last_seen_at: new Date().toISOString(),
      agent_version: body.agent_version ?? null,
    })
    .eq('id', device.id)

  return NextResponse.json({ ok: true, device_id: device.id, device_name: device.name })
}

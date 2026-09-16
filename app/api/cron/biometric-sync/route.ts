import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dahuaConfigFromEnv, findAccessRecords } from '@/lib/biometric/dahua'
import { getDeviceInfo } from '@/lib/biometric/dahua'
import { ingestPunches, type RawPunchInput } from '@/lib/biometric/ingest'

/**
 * Catch-up sync, pulling straight from the controller's own record log.
 *
 * This only works when the device is reachable from the internet (static IP or
 * DDNS plus a forwarded port) — configure DAHUA_HOST to switch it on. In the
 * usual LAN-only install the bridge agent does its own catch-up instead and
 * this route reports that it is not configured, which is not an error.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOOKBACK_HOURS = Number(process.env.BIOMETRIC_SYNC_LOOKBACK_HOURS ?? 24)

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const isVercelCron = (req.headers.get('user-agent') ?? '').startsWith('vercel-cron')
  const secretOk = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!secretOk && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cfg = dahuaConfigFromEnv()
  if (!cfg) {
    return NextResponse.json({
      skipped: true,
      reason: 'DAHUA_HOST / DAHUA_USERNAME / DAHUA_PASSWORD not set — device is LAN-only, the bridge agent handles sync',
    })
  }

  const end = new Date()
  const start = new Date(end.getTime() - LOOKBACK_HOURS * 3600 * 1000)

  try {
    const info = await getDeviceInfo(cfg).catch(() => ({ serialNumber: null }))
    const records = await findAccessRecords(cfg, { start, end })

    const punches: RawPunchInput[] = records.map(r => ({
      userId: r.userId,
      cardNo: r.cardNo,
      cardName: r.cardName,
      timestamp: r.createTime,
      method: r.method,
      direction: r.direction,
      door: r.door,
      status: r.status,
      errorCode: r.errorCode,
      recNo: r.recNo,
      raw: r.raw,
    }))

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const result = await ingestPunches(supabase, punches, {
      deviceSerial: info.serialNumber ?? cfg.host,
      deviceIp: cfg.host,
      source: 'poll',
    })

    return NextResponse.json({
      window: { from: start.toISOString(), to: end.toISOString() },
      ...result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('biometric-sync failed', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

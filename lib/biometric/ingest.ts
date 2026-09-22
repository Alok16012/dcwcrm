/**
 * Turning device punches into attendance.
 *
 * Every event the controller reports is stored verbatim in biometric_punches —
 * that table is the audit trail and is never rewritten. The attendance row for
 * a day is then *derived* from those punches: first valid punch is clock-in,
 * last is clock-out. Deriving (rather than incrementally patching) means a
 * late-arriving punch from the catch-up poller fixes the day automatically.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { methodLabel } from './dahua'
import { evaluateDay, loadHrmsSettings, type HrmsSettings } from '@/lib/hrms/attendance-rules'

/** Service-role client; these writes bypass RLS by design. */
type Db = SupabaseClient<any, any, any>

/** A punch shorter than this after the previous one is the same person being
 *  recognised twice while standing at the door, not a real second event. */
const MIN_SPAN_SECONDS = Number(process.env.BIOMETRIC_MIN_SPAN_SECONDS ?? 120)

export interface RawPunchInput {
  /** UserID as configured on the controller. */
  userId?: string | null
  cardNo?: string | null
  cardName?: string | null
  /** ISO 8601 string, or seconds since the Unix epoch. */
  timestamp: string | number
  method?: number | null
  direction?: string | null
  door?: number | null
  /** Dahua Status: 1 = door opened. Anything else is a denied attempt. */
  status?: number | string | null
  errorCode?: number | null
  eventCode?: string | null
  recNo?: number | null
  raw?: unknown
}

export interface IngestOptions {
  deviceSerial?: string | null
  deviceName?: string | null
  deviceIp?: string | null
  source?: 'agent' | 'poll' | 'manual'
}

export interface IngestResult {
  received: number
  stored: number
  duplicates: number
  unmapped: number
  attendanceUpdated: number
  errors: string[]
}

// --------------------------------------------------------------- IST time ---

const IST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const IST_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** The attendance table is keyed on the IST calendar day, not UTC. */
export function istParts(d: Date): { date: string; time: string } {
  return { date: IST_DATE.format(d), time: IST_TIME.format(d) }
}

function toDate(ts: string | number): Date | null {
  if (typeof ts === 'number') {
    // The controller reports seconds; tolerate millisecond callers too.
    const ms = ts > 1e12 ? ts : ts * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const numeric = Number(ts)
  if (Number.isFinite(numeric) && /^\d+$/.test(ts.trim())) return toDate(numeric)
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? null : d
}

// ---------------------------------------------------------------- devices ---

/**
 * Find (or self-register) the device row for a serial. Auto-registering keeps
 * installation zero-touch: point the bridge agent at the CRM and the device
 * appears in the HRMS screen, ready to be named.
 */
export async function resolveDevice(
  db: Db,
  opts: IngestOptions
): Promise<{ id: string; name: string } | null> {
  const serial = opts.deviceSerial?.trim()
  if (!serial) return null

  const { data: existing } = await db
    .from('biometric_devices')
    .select('id, name')
    .eq('serial_no', serial)
    .maybeSingle()

  if (existing) {
    await db
      .from('biometric_devices')
      .update({
        last_seen_at: new Date().toISOString(),
        ...(opts.deviceIp ? { ip_address: opts.deviceIp } : {}),
      })
      .eq('id', existing.id)
    return existing as { id: string; name: string }
  }

  const { data: created, error } = await db
    .from('biometric_devices')
    .insert({
      name: opts.deviceName?.trim() || `Dahua ${serial}`,
      serial_no: serial,
      ip_address: opts.deviceIp ?? null,
      last_seen_at: new Date().toISOString(),
    })
    .select('id, name')
    .single()

  if (error) return null
  return created as { id: string; name: string }
}

// ----------------------------------------------------------------- ingest ---

export async function ingestPunches(
  db: Db,
  punches: RawPunchInput[],
  opts: IngestOptions = {}
): Promise<IngestResult> {
  const result: IngestResult = {
    received: punches.length,
    stored: 0,
    duplicates: 0,
    unmapped: 0,
    attendanceUpdated: 0,
    errors: [],
  }
  if (punches.length === 0) return result

  const source = opts.source ?? 'agent'
  const device = await resolveDevice(db, opts)
  const serial = opts.deviceSerial?.trim() || 'unknown'

  // Map device identities to employees in one query.
  const userIds = [...new Set(punches.map(p => p.userId).filter(Boolean))] as string[]
  const cardNos = [...new Set(punches.map(p => p.cardNo).filter(Boolean))] as string[]

  const employeeByUserId = new Map<string, string>()
  const employeeByCardNo = new Map<string, string>()

  if (userIds.length || cardNos.length) {
    const filters: string[] = []
    if (userIds.length) filters.push(`biometric_user_id.in.(${userIds.join(',')})`)
    if (cardNos.length) filters.push(`biometric_card_no.in.(${cardNos.join(',')})`)

    const { data: employees } = await db
      .from('employees')
      .select('id, biometric_user_id, biometric_card_no')
      .or(filters.join(','))

    for (const e of (employees ?? []) as {
      id: string
      biometric_user_id: string | null
      biometric_card_no: string | null
    }[]) {
      if (e.biometric_user_id) employeeByUserId.set(e.biometric_user_id, e.id)
      if (e.biometric_card_no) employeeByCardNo.set(e.biometric_card_no, e.id)
    }
  }

  const rows: Record<string, unknown>[] = []
  const affected = new Map<string, { employeeId: string; date: string }>()
  let latestEvent: Date | null = null

  for (const p of punches) {
    const at = toDate(p.timestamp)
    if (!at) {
      result.errors.push(`Unparsable timestamp: ${String(p.timestamp)}`)
      continue
    }
    if (!latestEvent || at > latestEvent) latestEvent = at

    const { date, time } = istParts(at)
    const employeeId =
      (p.userId ? employeeByUserId.get(p.userId) : undefined) ??
      (p.cardNo ? employeeByCardNo.get(p.cardNo) : undefined) ??
      null

    if (!employeeId) result.unmapped++

    // Dahua Status 1 = granted. A denied attempt is logged but never counted.
    const granted =
      p.status == null || String(p.status) === '1' || String(p.status).toLowerCase() === 'success'

    rows.push({
      device_id: device?.id ?? null,
      device_serial: serial,
      biometric_user_id: p.userId ?? null,
      card_no: p.cardNo ?? null,
      card_name: p.cardName ?? null,
      employee_id: employeeId,
      punched_at: at.toISOString(),
      punch_date: date,
      punch_time: time,
      method: methodLabel(p.method),
      raw_method: p.method ?? null,
      direction: p.direction ?? null,
      door: p.door ?? null,
      status: granted ? 'success' : 'denied',
      error_code: p.errorCode ?? null,
      event_code: p.eventCode ?? null,
      rec_no: p.recNo ?? null,
      source,
      dedupe_key: `${serial}:${p.userId ?? p.cardNo ?? 'anon'}:${Math.floor(at.getTime() / 1000)}`,
      raw: (p.raw ?? null) as never,
    })

    if (employeeId && granted) affected.set(`${employeeId}|${date}`, { employeeId, date })
  }

  if (rows.length === 0) return result

  // ignoreDuplicates makes re-delivery (agent retry, poller overlap) a no-op.
  const { data: inserted, error } = await db
    .from('biometric_punches')
    .upsert(rows as never, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('id')

  if (error) {
    result.errors.push(`punch insert: ${error.message}`)
    return result
  }

  result.stored = inserted?.length ?? 0
  result.duplicates = rows.length - result.stored

  if (device && latestEvent) {
    await db
      .from('biometric_devices')
      .update({ last_event_at: latestEvent.toISOString() })
      .eq('id', device.id)
  }

  const settings = await loadHrmsSettings(db)
  for (const { employeeId, date } of affected.values()) {
    const ok = await recomputeAttendance(db, employeeId, date, device?.id ?? null, settings)
    if (ok) result.attendanceUpdated++
  }

  return result
}

// --------------------------------------------------------------- rollup -----

/**
 * Rebuild one employee's attendance row for one day from their punches.
 *
 * A day the admin has already marked 'leave' or 'holiday' keeps that status —
 * the punch times are still recorded, but the payroll-relevant verdict stays
 * with the human who set it.
 */
export async function recomputeAttendance(
  db: Db,
  employeeId: string,
  date: string,
  deviceId: string | null = null,
  settings?: HrmsSettings
): Promise<boolean> {
  const rules = settings ?? await loadHrmsSettings(db)
  const { data: punches, error } = await db
    .from('biometric_punches')
    .select('punch_time, punched_at')
    .eq('employee_id', employeeId)
    .eq('punch_date', date)
    .eq('status', 'success')
    .order('punched_at', { ascending: true })

  if (error || !punches || punches.length === 0) return false

  const list = punches as { punch_time: string; punched_at: string }[]
  const first = list[0]
  const last = list[list.length - 1]

  const spanSeconds =
    (new Date(last.punched_at).getTime() - new Date(first.punched_at).getTime()) / 1000

  const clockIn = first.punch_time
  // A single recognition (or two seconds apart) is an arrival, not a full day.
  const clockOut = spanSeconds >= MIN_SPAN_SECONDS ? last.punch_time : null

  const { data: existing } = await db
    .from('attendance')
    .select('id, status, clock_in, clock_out')
    .eq('employee_id', employeeId)
    .eq('date', date)
    .maybeSingle()

  // A day a human marked as leave/holiday keeps that verdict; the punch times
  // are still recorded underneath it.
  const HUMAN_SET = ['leave', 'holiday', 'cl', 'sl', 'lwp']
  const locked = existing && HUMAN_SET.includes((existing as { status: string }).status)

  const verdict = evaluateDay(
    { date, clockIn: clockIn.slice(0, 5), clockOut: clockOut ? clockOut.slice(0, 5) : null },
    rules,
  )

  const payload: Record<string, unknown> = {
    employee_id: employeeId,
    date,
    clock_in: clockIn,
    clock_out: clockOut,
    status: locked ? (existing as { status: string }).status : verdict.status,
    auto_status: verdict.status,
    work_minutes: verdict.workMinutes,
    late_minutes: verdict.lateMinutes,
    early_minutes: verdict.earlyMinutes,
    computed_at: new Date().toISOString(),
    source: 'biometric',
    biometric_device_id: deviceId,
  }

  let { error: upsertErr } = await db
    .from('attendance')
    .upsert(payload as never, { onConflict: 'employee_id,date' })

  // Before migration 107 the engine columns don't exist yet — save the day
  // without them rather than losing the punch rollup entirely.
  if (upsertErr && /auto_status|work_minutes|late_minutes|early_minutes|computed_at/.test(upsertErr.message ?? '')) {
    const { auto_status, work_minutes, late_minutes, early_minutes, computed_at, ...legacy } = payload
    ;({ error: upsertErr } = await db
      .from('attendance')
      .upsert(legacy as never, { onConflict: 'employee_id,date' }))
  }

  return !upsertErr
}

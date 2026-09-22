import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { recomputeAttendance } from '@/lib/biometric/ingest'
import { loadHrmsSettings } from '@/lib/hrms/attendance-rules'

/**
 * Re-derive attendance from the stored biometric punches for a date range.
 *
 * Needed whenever the rules change (grace/late windows edited in HRMS Settings)
 * or punches arrived late — the raw punches are never rewritten, so the day can
 * always be rebuilt from them. Days a human marked (leave/holiday/CL/SL/LWP)
 * keep their verdict; recomputeAttendance protects those.
 */
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user.id).single()) as { data: { role: string } | null }
  if (!profile || !['admin', 'backend'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { from?: string; to?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  if (!isDate(body.from) || !isDate(body.to)) {
    return NextResponse.json({ error: 'from and to must be yyyy-MM-dd dates' }, { status: 400 })
  }
  const from = body.from!, to = body.to!
  if (from > to) return NextResponse.json({ error: '"from" is after "to"' }, { status: 400 })

  // Writes bypass RLS; the role check above is the gate.
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as never as Parameters<typeof recomputeAttendance>[0]

  const { data: punches, error } = await (db as unknown as { from: (t: string) => any })
    .from('biometric_punches')
    .select('employee_id, punch_date')
    .gte('punch_date', from)
    .lte('punch_date', to)
    .eq('status', 'success')
    .not('employee_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // One recompute per employee-day, however many punches that day holds
  const days = new Map<string, { employeeId: string; date: string }>()
  for (const p of (punches ?? []) as { employee_id: string; punch_date: string }[]) {
    days.set(`${p.employee_id}|${p.punch_date}`, { employeeId: p.employee_id, date: p.punch_date })
  }

  const settings = await loadHrmsSettings(db as never)
  let updated = 0
  for (const { employeeId, date } of days.values()) {
    if (await recomputeAttendance(db, employeeId, date, null, settings)) updated++
  }

  return NextResponse.json({ ok: true, range: { from, to }, employeeDays: days.size, updated })
}

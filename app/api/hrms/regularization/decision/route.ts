import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { evaluateDay, loadHrmsSettings } from '@/lib/hrms/attendance-rules'
import { writeAudit } from '@/lib/hrms/audit'

/**
 * Approve or reject an attendance regularization (requirement doc §15).
 *
 * Approving writes the requested punch times onto the day and re-runs the
 * attendance rules over them, so a corrected time immediately gives the right
 * late / half-day verdict. The raw biometric punches are untouched.
 */
export const runtime = 'nodejs'

type Db = { from: (t: string) => any }

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = (await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single()) as
    { data: { role: string; full_name: string } | null }
  if (!profile || !['admin', 'backend'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { id?: string; action?: string; reason?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.id || !['approve', 'reject'].includes(body.action ?? '')) {
    return NextResponse.json({ error: 'id and action (approve|reject) are required' }, { status: 400 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as unknown as Db

  const { data: reg } = await db
    .from('attendance_regularizations')
    .select('id, employee_id, work_date, punch_type, requested_in, requested_out, status')
    .eq('id', body.id).maybeSingle()
  if (!reg) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (reg.status !== 'pending') return NextResponse.json({ error: `Already ${reg.status}` }, { status: 409 })

  const now = new Date().toISOString()
  const auditBase = { changedBy: user.id, changedByName: profile.full_name, entityId: reg.id }

  if (body.action === 'reject') {
    const { error } = await db.from('attendance_regularizations').update({
      status: 'rejected', rejection_reason: body.reason?.trim() || null,
      reviewed_by: user.id, reviewed_at: now,
    }).eq('id', reg.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await writeAudit(db as never, {
      ...auditBase, entity: 'regularization', action: 'rejected', reason: body.reason ?? null,
    })
    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  const { data: existing } = await db
    .from('attendance').select('id, status, clock_in, clock_out')
    .eq('employee_id', reg.employee_id).eq('date', reg.work_date).maybeSingle()

  // Only the punch the request is about is replaced; the other side stands
  const clockIn = reg.punch_type === 'out'
    ? existing?.clock_in ?? null
    : reg.requested_in ?? existing?.clock_in ?? null
  const clockOut = reg.punch_type === 'in'
    ? existing?.clock_out ?? null
    : reg.requested_out ?? existing?.clock_out ?? null

  const settings = await loadHrmsSettings(db as never)
  const { data: permission } = await db
    .from('special_late_permissions').select('allowed_till')
    .eq('employee_id', reg.employee_id).eq('work_date', reg.work_date).maybeSingle()

  const verdict = evaluateDay({
    date: reg.work_date,
    clockIn: clockIn ? String(clockIn).slice(0, 5) : null,
    clockOut: clockOut ? String(clockOut).slice(0, 5) : null,
    allowedTill: permission?.allowed_till ? String(permission.allowed_till).slice(0, 5) : null,
  }, settings)

  const { error: attErr } = await db.from('attendance').upsert({
    employee_id: reg.employee_id,
    date: reg.work_date,
    clock_in: clockIn,
    clock_out: clockOut,
    status: verdict.status,
    auto_status: verdict.status,
    work_minutes: verdict.workMinutes,
    late_minutes: verdict.lateMinutes,
    early_minutes: verdict.earlyMinutes,
    computed_at: now,
    source: 'regularization',
  } as never, { onConflict: 'employee_id,date' })
  if (attErr) return NextResponse.json({ error: `Attendance update failed: ${attErr.message}` }, { status: 500 })

  const { error } = await db.from('attendance_regularizations').update({
    status: 'approved', reviewed_by: user.id, reviewed_at: now,
  }).eq('id', reg.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAudit(db as never, {
    ...auditBase,
    entity: 'attendance',
    action: 'regularized',
    oldValue: existing ? { status: existing.status, clock_in: existing.clock_in, clock_out: existing.clock_out } : null,
    newValue: { status: verdict.status, clock_in: clockIn, clock_out: clockOut },
    reason: body.reason ?? null,
  })

  return NextResponse.json({ ok: true, status: 'approved', attendance: verdict.status })
}

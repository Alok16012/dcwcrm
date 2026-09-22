import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { loadHrmsSettings } from '@/lib/hrms/attendance-rules'
import { balanceFor, expandLeaveDays, leaveKindOf, splitPaidAndLwp } from '@/lib/hrms/leave'
import { writeAudit } from '@/lib/hrms/audit'

/**
 * Approve or reject a leave request (requirement doc §12, §13).
 *
 * Approving writes the attendance for those days: weekly offs and holidays in
 * the range are skipped, paid balance is consumed first and anything beyond it
 * lands as LWP — which is what payroll later deducts.
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

  const { data: reqRow, error: reqErr } = await db
    .from('leave_requests')
    .select('id, employee_id, leave_type, from_date, to_date, status')
    .eq('id', body.id)
    .maybeSingle()
  if (reqErr || !reqRow) return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
  if (reqRow.status !== 'pending') {
    return NextResponse.json({ error: `Already ${reqRow.status}` }, { status: 409 })
  }

  const now = new Date().toISOString()

  if (body.action === 'reject') {
    const { error } = await db.from('leave_requests').update({
      status: 'rejected',
      rejection_reason: body.reason?.trim() || null,
      approved_by: user.id,
      approved_at: now,
      updated_at: now,
    }).eq('id', reqRow.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await writeAudit(db as never, {
      entity: 'leave_request', entityId: reqRow.id, action: 'rejected',
      reason: body.reason ?? null, changedBy: user.id, changedByName: profile.full_name,
    })
    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  const settings = await loadHrmsSettings(db as never)

  const { data: holidayRows } = await db
    .from('holidays').select('holiday_date').eq('is_active', true)
    .gte('holiday_date', reqRow.from_date).lte('holiday_date', reqRow.to_date)
  const holidays = new Set(((holidayRows ?? []) as { holiday_date: string }[]).map(h => h.holiday_date))

  const days = expandLeaveDays(reqRow.from_date, reqRow.to_date, settings, holidays)
  if (days.length === 0) {
    return NextResponse.json({ error: 'Range has no working days (weekly off / holiday only)' }, { status: 400 })
  }

  const kind = leaveKindOf(reqRow.leave_type)
  let paid = days, lwp: string[] = []

  if (kind !== 'lwp') {
    const { data: emp } = await db.from('employees').select('joining_date').eq('id', reqRow.employee_id).maybeSingle()

    // Every approved day of this kind so far, to work out the running balance
    const { data: taken } = await db
      .from('attendance').select('date').eq('employee_id', reqRow.employee_id).eq('status', kind)
    const usedDates = ((taken ?? []) as { date: string }[]).map(t => t.date)

    const [y, m] = days[0].split('-').map(Number)
    const balance = balanceFor(kind, {
      joiningDate: (emp as { joining_date: string | null } | null)?.joining_date ?? null,
      year: y, month: m, usedDates, settings,
    })
    const split = splitPaidAndLwp(days, balance.available)
    paid = split.paid
    lwp = split.lwp
  } else {
    paid = []
    lwp = days
  }

  const rows = [
    ...paid.map(date => ({ employee_id: reqRow.employee_id, date, status: kind, source: 'leave' })),
    ...lwp.map(date => ({ employee_id: reqRow.employee_id, date, status: 'lwp', source: 'leave' })),
  ]

  const { error: attErr } = await db
    .from('attendance').upsert(rows as never, { onConflict: 'employee_id,date' })
  if (attErr) return NextResponse.json({ error: `Attendance update failed: ${attErr.message}` }, { status: 500 })

  const { error } = await db.from('leave_requests').update({
    status: 'approved',
    days: days.length,
    approved_by: user.id,
    approved_at: now,
    updated_at: now,
  }).eq('id', reqRow.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAudit(db as never, {
    entity: 'leave_request', entityId: reqRow.id, action: 'approved',
    oldValue: { status: 'pending' },
    newValue: { status: 'approved', days: days.length, paid: paid.length, lwp: lwp.length },
    changedBy: user.id, changedByName: profile.full_name,
  })

  return NextResponse.json({
    ok: true,
    status: 'approved',
    days: days.length,
    paidDays: paid.length,
    lwpDays: lwp.length,
  })
}

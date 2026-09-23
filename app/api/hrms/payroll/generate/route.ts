import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { loadHrmsSettings } from '@/lib/hrms/attendance-rules'
import { computePayroll, countAttendance } from '@/lib/hrms/payroll'
import { writeAudit } from '@/lib/hrms/audit'

/**
 * Generate (or refresh) payroll for a month from the attendance that is
 * already on the calendar — requirement doc §18 and §32 step 7.
 *
 * Locked rows are left alone: once payroll is locked it only changes through
 * an explicit unlock, which is itself audited.
 */
export const runtime = 'nodejs'

type Db = { from: (t: string) => any }

const EMPLOYEE_COLS = 'id, basic_salary, hra, allowances, incentive, pf_deduction, tds_deduction, other_deductions'

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

  // employee_id scopes the run to one person — the employee page's "Generate
  // Month" button sends it, along with the incentive verified for them.
  let body: { month?: number; year?: number; employee_id?: string; incentive?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const month = Number(body.month), year = Number(body.year)
  const onlyEmployeeId = typeof body.employee_id === 'string' && body.employee_id ? body.employee_id : null
  const verifiedIncentive = Number(body.incentive)
  if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) {
    return NextResponse.json({ error: 'Valid month (1-12) and year are required' }, { status: 400 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as unknown as Db

  const settings = await loadHrmsSettings(db as never)
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`

  const [{ data: employees }, { data: attendance }, { data: existing }, { data: advances }, { data: holidayRows }] = await Promise.all([
    onlyEmployeeId
      ? db.from('employees').select(EMPLOYEE_COLS).eq('id', onlyEmployeeId)
      : db.from('employees').select(EMPLOYEE_COLS).eq('is_active', true),
    db.from('attendance').select('employee_id, status').gte('date', from).lte('date', to),
    db.from('payroll').select('id, employee_id, is_locked, incentive').eq('month', month).eq('year', year),
    db.from('advance_salaries').select('id, employee_id, amount, status, settled_in').in('status', ['pending', 'settled']).lte('given_on', to),
    db.from('holidays').select('holiday_date').eq('is_active', true).gte('holiday_date', from).lte('holiday_date', to),
  ])

  // Days the month actually expected work: not the weekly off, not a holiday.
  // A day with no attendance row at all deducts nothing, so payroll would
  // silently pay in full — the response reports it and the UI warns.
  const holidays = new Set(((holidayRows ?? []) as { holiday_date: string }[]).map(h => h.holiday_date))
  let expectedWorkingDays = 0
  for (let d = 1; d <= new Date(year, month, 0).getDate(); d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (new Date(`${iso}T12:00:00`).getDay() === settings.weekly_off_day) continue
    if (holidays.has(iso)) continue
    expectedWorkingDays++
  }

  const byEmp = new Map<string, { status: string }[]>()
  for (const a of (attendance ?? []) as { employee_id: string; status: string }[]) {
    if (!byEmp.has(a.employee_id)) byEmp.set(a.employee_id, [])
    byEmp.get(a.employee_id)!.push({ status: a.status })
  }
  const lockedBy = new Map<string, boolean>()
  const idByEmp = new Map<string, string>()
  const incentiveByEmp = new Map<string, number>()
  for (const p of (existing ?? []) as { id: string; employee_id: string; is_locked: boolean; incentive: number | null }[]) {
    lockedBy.set(p.employee_id, p.is_locked)
    idByEmp.set(p.employee_id, p.id)
    incentiveByEmp.set(p.employee_id, Number(p.incentive ?? 0))
  }

  // Advances recovered this month: everything still pending, plus whatever was
  // already recovered in this month's row (so re-generating doesn't drop it).
  const advanceRowsByEmp = new Map<string, { id: string; amount: number }[]>()
  for (const a of (advances ?? []) as { id: string; employee_id: string; amount: number | null; status: string; settled_in: string | null }[]) {
    const belongsHere = a.status === 'pending' || a.settled_in === idByEmp.get(a.employee_id)
    if (!belongsHere) continue
    const list = advanceRowsByEmp.get(a.employee_id) ?? []
    list.push({ id: a.id, amount: Number(a.amount ?? 0) })
    advanceRowsByEmp.set(a.employee_id, list)
  }
  const advanceByEmp = new Map<string, number>()
  for (const [empId, rows] of advanceRowsByEmp) {
    advanceByEmp.set(empId, rows.reduce((sum, r) => sum + r.amount, 0))
  }

  let generated = 0, skippedLocked = 0, unmarkedDays = 0, employeesWithGaps = 0
  const countsByEmp = new Map<string, ReturnType<typeof countAttendance>>()
  const now = new Date().toISOString()

  for (const e of (employees ?? []) as Record<string, any>[]) {
    if (lockedBy.get(e.id)) { skippedLocked++; continue }

    const marked = byEmp.get(e.id) ?? []
    const counts = countAttendance(marked)
    countsByEmp.set(e.id, counts)
    const gap = Math.max(0, expectedWorkingDays - marked.filter(r => r.status !== 'weekly_off' && r.status !== 'holiday').length)
    if (gap > 0) { unmarkedDays += gap; employeesWithGaps++ }
    const monthlySalary = Number(e.basic_salary ?? 0)
    const advanceRecovery = advanceByEmp.get(e.id) ?? 0
    // Incentive already credited for this month wins over the employee's fixed amount
    const existingIncentive = incentiveByEmp.get(e.id) ?? 0
    const sentIncentive = onlyEmployeeId && Number.isFinite(verifiedIncentive) ? verifiedIncentive : 0
    const incentive = Math.max(existingIncentive, sentIncentive) > 0
      ? Math.max(existingIncentive, sentIncentive)
      : Number(e.incentive ?? 0)

    const b = computePayroll({
      monthlySalary,
      counts,
      additions: { hra: Number(e.hra ?? 0), allowances: Number(e.allowances ?? 0), incentive },
      statutory: { pf: Number(e.pf_deduction ?? 0), tds: Number(e.tds_deduction ?? 0), other: Number(e.other_deductions ?? 0) },
      advanceRecovery,
      settings,
    })

    const row = {
      employee_id: e.id, month, year,
      basic: monthlySalary, hra: Number(e.hra ?? 0), allowances: Number(e.allowances ?? 0),
      incentive,
      gross: b.gross,
      pf: Number(e.pf_deduction ?? 0), tds: Number(e.tds_deduction ?? 0),
      other_deductions: Number(e.other_deductions ?? 0),
      leave_deduction: b.lopDeduction,
      late_deduction: b.lateDeduction,
      advance_deduction: advanceRecovery,
      net: b.net,
      working_days: settings.working_days,
      present_days: counts.present, late_days: counts.late, half_days: counts.half_day,
      absent_days: counts.absent, cl_days: counts.cl, sl_days: counts.sl, lwp_days: counts.lwp,
      weekly_offs: counts.weekly_off, holidays_count: counts.holiday,
      per_day_salary: b.perDaySalary,
      status: 'draft',
      generated_at: now,
    }

    const id = idByEmp.get(e.id)
    const { data: savedRow, error } = id
      ? await db.from('payroll').update(row).eq('id', id).select('id').single()
      : await db.from('payroll').insert(row).select('id').single()

    // Tie the recovered advances to this payroll row so they aren't deducted again
    const payrollId = (savedRow as { id: string } | null)?.id ?? id
    const recovered = advanceRowsByEmp.get(e.id) ?? []
    if (!error && payrollId && recovered.length > 0) {
      await db.from('advance_salaries')
        .update({ status: 'settled', settled_in: payrollId })
        .in('id', recovered.map(r => r.id))
    }
    if (!error) generated++
  }

  await writeAudit(db as never, {
    entity: 'payroll', entityId: `${year}-${month}`, action: 'generated',
    newValue: { generated, skippedLocked, unmarkedDays, employeesWithGaps },
    changedBy: user.id, changedByName: profile.full_name,
  })

  if (onlyEmployeeId) {
    if (skippedLocked > 0) {
      return NextResponse.json({ error: 'Is mahine ka payroll locked hai — pehle unlock karo' }, { status: 409 })
    }
    const { data: payroll } = await db.from('payroll').select('*')
      .eq('employee_id', onlyEmployeeId).eq('month', month).eq('year', year).maybeSingle()
    if (!payroll) return NextResponse.json({ error: 'Payroll could not be generated for this employee' }, { status: 404 })
    const c = countsByEmp.get(onlyEmployeeId)
    // countAttendance counts a late day as present too; the table adds them back
    const attendance = c
      ? { present: c.present - c.late, late: c.late, absent: c.absent, half_day: c.half_day, leave: c.lwp, holiday: c.holiday }
      : null
    return NextResponse.json({
      ok: true, month, year, generated, skippedLocked,
      expectedWorkingDays, unmarkedDays, employeesWithGaps,
      payroll, attendance,
    })
  }

  return NextResponse.json({
    ok: true, month, year, generated, skippedLocked,
    expectedWorkingDays, unmarkedDays, employeesWithGaps,
  })
}

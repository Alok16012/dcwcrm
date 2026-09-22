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

  let body: { month?: number; year?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const month = Number(body.month), year = Number(body.year)
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

  const [{ data: employees }, { data: attendance }, { data: existing }, { data: advances }] = await Promise.all([
    db.from('employees')
      .select('id, basic_salary, hra, allowances, incentive, pf_deduction, tds_deduction, other_deductions')
      .eq('is_active', true),
    db.from('attendance').select('employee_id, status').gte('date', from).lte('date', to),
    db.from('payroll').select('id, employee_id, is_locked').eq('month', month).eq('year', year),
    db.from('advance_salaries').select('employee_id, monthly_deduction, status').eq('status', 'active'),
  ])

  const byEmp = new Map<string, { status: string }[]>()
  for (const a of (attendance ?? []) as { employee_id: string; status: string }[]) {
    if (!byEmp.has(a.employee_id)) byEmp.set(a.employee_id, [])
    byEmp.get(a.employee_id)!.push({ status: a.status })
  }
  const lockedBy = new Map<string, boolean>()
  const idByEmp = new Map<string, string>()
  for (const p of (existing ?? []) as { id: string; employee_id: string; is_locked: boolean }[]) {
    lockedBy.set(p.employee_id, p.is_locked)
    idByEmp.set(p.employee_id, p.id)
  }
  const advanceByEmp = new Map<string, number>()
  for (const a of (advances ?? []) as { employee_id: string; monthly_deduction: number | null }[]) {
    advanceByEmp.set(a.employee_id, Number(a.monthly_deduction ?? 0))
  }

  let generated = 0, skippedLocked = 0
  const now = new Date().toISOString()

  for (const e of (employees ?? []) as Record<string, any>[]) {
    if (lockedBy.get(e.id)) { skippedLocked++; continue }

    const counts = countAttendance(byEmp.get(e.id) ?? [])
    const monthlySalary = Number(e.basic_salary ?? 0)
    const advanceRecovery = advanceByEmp.get(e.id) ?? 0

    const b = computePayroll({
      monthlySalary,
      counts,
      additions: { hra: Number(e.hra ?? 0), allowances: Number(e.allowances ?? 0), incentive: Number(e.incentive ?? 0) },
      statutory: { pf: Number(e.pf_deduction ?? 0), tds: Number(e.tds_deduction ?? 0), other: Number(e.other_deductions ?? 0) },
      advanceRecovery,
      settings,
    })

    const row = {
      employee_id: e.id, month, year,
      basic: monthlySalary, hra: Number(e.hra ?? 0), allowances: Number(e.allowances ?? 0),
      incentive: Number(e.incentive ?? 0),
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
    const { error } = id
      ? await db.from('payroll').update(row).eq('id', id)
      : await db.from('payroll').insert(row)
    if (!error) generated++
  }

  await writeAudit(db as never, {
    entity: 'payroll', entityId: `${year}-${month}`, action: 'generated',
    newValue: { generated, skippedLocked },
    changedBy: user.id, changedByName: profile.full_name,
  })

  return NextResponse.json({ ok: true, month, year, generated, skippedLocked })
}

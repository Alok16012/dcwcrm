import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'
import { BB_MANAGER_ROLES } from '@/lib/bb/constants'
import { cycleDates, computePayroll, tallyAttendance } from '@/lib/bb/payroll'

/**
 * Generate (or regenerate) one staff member's salary for a month.
 *
 * Attendance drives loss of pay, and placements credited to them inside the
 * same cycle drive the incentive — so the slip is reproducible from data
 * rather than typed in by hand.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user.id).single()) as { data: { role: string } | null }
  if (!profile || !BB_MANAGER_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { employee_id?: string; month?: number; year?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { employee_id, month, year } = body
  if (!employee_id || !month || !year) {
    return NextResponse.json({ error: 'employee_id, month and year are required' }, { status: 400 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  ) as any

  const { data: emp, error: empErr } = await db
    .from('bb_employees').select('*').eq('id', employee_id).single()
  if (empErr || !emp) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

  const { start, end } = cycleDates(year, month, Number(emp.salary_cycle_start_day ?? 1))
  const startStr = format(start, 'yyyy-MM-dd')
  const endStr = format(end, 'yyyy-MM-dd')

  const [attendanceRes, placementsRes, existingRes] = await Promise.all([
    db.from('bb_attendance').select('status')
      .eq('employee_id', employee_id).gte('date', startStr).lte('date', endStr),
    // Credited on the placement, keyed by profile — the person, not the HR row.
    db.from('bb_placements').select('total_commission')
      .eq('credited_to', emp.profile_id).gte('joined_on', startStr).lte('joined_on', endStr),
    db.from('bb_payroll').select('id, status')
      .eq('employee_id', employee_id).eq('month', month).eq('year', year).maybeSingle(),
  ])

  if (existingRes.data?.status === 'paid') {
    return NextResponse.json({ error: 'Salary for this month is already marked paid' }, { status: 400 })
  }

  const tally = tallyAttendance((attendanceRes.data ?? []) as { status: string }[])
  const placements = ((placementsRes.data ?? []) as any[]).map(p => ({
    commission: Number(p.total_commission ?? 0),
  }))

  const c = computePayroll(emp, tally, placements)

  const payload = {
    employee_id,
    month,
    year,
    basic: c.basic,
    hra: c.hra,
    allowances: c.allowances,
    present_days: c.presentDays,
    absent_days: c.absentDays,
    half_days: c.halfDays,
    leave_days: c.leaveDays,
    lop_days: c.lopDays,
    leave_deduction: c.leaveDeduction,
    placement_count: c.placementCount,
    placement_incentive: c.placementIncentive,
    gross: c.gross,
    pf: c.pf,
    tds: c.tds,
    other_deductions: c.otherDeductions,
    net: c.net,
    generated_by: user.id,
  }

  const { error } = existingRes.data
    ? await db.from('bb_payroll').update(payload).eq('id', existingRes.data.id)
    : await db.from('bb_payroll').insert({ ...payload, status: 'draft' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    ok: true,
    cycle: { from: startStr, to: endStr },
    ...c,
  })
}

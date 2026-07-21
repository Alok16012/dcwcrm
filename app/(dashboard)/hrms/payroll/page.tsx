import { redirect } from 'next/navigation'
import { format, getMonth, getYear } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
import PayrollTable from '@/components/hrms/PayrollTable'
import PayrollMonthSelector from '@/components/hrms/PayrollMonthSelector'

// Roles that draw a salary from HRMS payroll (students/associates are separate)
const INTERNAL_ROLES = ['admin', 'lead', 'telecaller', 'counselor', 'backend', 'housekeeping']

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  const sp = await searchParams
  const now = new Date()
  const month = Number(sp.month ?? getMonth(now) + 1)
  const year = Number(sp.year ?? getYear(now))

  // 1) All employees + their salary structure (the salary always shows, even
  //    before payroll is generated for the selected month).
  type EmpRaw = {
    id: string; profile_id: string; employee_code: string | null; designation: string | null
    department: string | null; bank_account: string | null; salary_cycle_start_day: number | null
    basic_salary: number | null; hra: number | null; allowances: number | null
    pf_deduction: number | null; tds_deduction: number | null; other_deductions: number | null
    is_active: boolean
  }
  const { data: empsRaw, error: empErr } = await supabase
    .from('employees')
    .select('id, profile_id, employee_code, designation, department, bank_account, salary_cycle_start_day, basic_salary, hra, allowances, pf_deduction, tds_deduction, other_deductions, is_active')
    .eq('is_active', true)
  if (empErr) {
    return <div className="p-4 text-red-500">Failed to load employees: {empErr.message}</div>
  }
  const allEmps = (empsRaw ?? []) as EmpRaw[]

  // Names + roles (role decides who counts as internal staff)
  const profileIds = allEmps.map((e) => e.profile_id).filter(Boolean)
  const { data: profsRaw } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, role').in('id', profileIds)
    : { data: [] }
  const profMap = Object.fromEntries(((profsRaw ?? []) as { id: string; full_name: string; role: string }[]).map((p) => [p.id, p]))

  const emps = allEmps
    .filter((e) => INTERNAL_ROLES.includes(profMap[e.profile_id]?.role ?? 'lead'))
    .sort((a, b) => (profMap[a.profile_id]?.full_name ?? '').localeCompare(profMap[b.profile_id]?.full_name ?? ''))
  const empMap = Object.fromEntries(emps.map((e) => [e.id, e]))
  const empIds = emps.map((e) => e.id)

  // 2) Generated payroll rows for the selected month/year
  const { data: payRaw, error } = empIds.length > 0
    ? await supabase
        .from('payroll')
        .select('id, employee_id, month, year, basic, hra, allowances, incentive, gross, pf, tds, other_deductions, leave_deduction, advance_deduction, net, status, payment_date')
        .eq('month', month)
        .eq('year', year)
        .in('employee_id', empIds)
    : { data: [], error: null }

  if (error) {
    return <div className="p-4 text-red-500">Failed to load payroll: {error.message}</div>
  }

  type RawPayroll = { id: string; employee_id: string; month: number; year: number; basic: number; hra: number; allowances: number; incentive: number; gross: number; pf: number; tds: number; other_deductions: number; leave_deduction: number; advance_deduction: number; net: number; status: string; payment_date: string | null }
  const payrollData = (payRaw ?? []) as RawPayroll[]
  const payByEmp = Object.fromEntries(payrollData.map((p) => [p.employee_id, p]))

  // 3) Attendance breakdown per employee for the selected cycle
  type AttCounts = { present: number; late: number; absent: number; half_day: number; leave: number; holiday: number }
  const attSummary: Record<string, AttCounts> = {}
  if (empIds.length > 0) {
    const cycleFor = (day: number) => day === 1
      ? { start: new Date(year, month - 1, 1), end: new Date(year, month, 0) }
      : { start: new Date(year, month - 2, day), end: new Date(year, month - 1, day - 1) }
    const cycles = emps.map((e) => ({ id: e.id, ...cycleFor(e.salary_cycle_start_day ?? 1) }))
    const rangeStart = new Date(Math.min(...cycles.map((c) => c.start.getTime())))
    const rangeEnd = new Date(Math.max(...cycles.map((c) => c.end.getTime())))
    const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd')
    const { data: attRaw } = await supabase
      .from('attendance')
      .select('employee_id, date, status')
      .in('employee_id', empIds)
      .gte('date', fmtDate(rangeStart))
      .lte('date', fmtDate(rangeEnd))
    const cycleMap = Object.fromEntries(cycles.map((c) => [c.id, { start: fmtDate(c.start), end: fmtDate(c.end) }]))
    for (const a of (attRaw ?? []) as { employee_id: string; date: string; status: string }[]) {
      const cyc = cycleMap[a.employee_id]
      if (!cyc || a.date < cyc.start || a.date > cyc.end) continue
      if (!attSummary[a.employee_id]) attSummary[a.employee_id] = { present: 0, late: 0, absent: 0, half_day: 0, leave: 0, holiday: 0 }
      const s = a.status as keyof AttCounts
      if (s in attSummary[a.employee_id]) attSummary[a.employee_id][s]++
    }
  }

  // 4) One row per employee — real payroll where generated, otherwise a
  //    not-yet-generated row synthesised from the salary structure.
  const num = (v: number | null | undefined) => Number(v ?? 0)
  const rows = emps.map((e) => {
    const p = payByEmp[e.id]
    const name = profMap[e.profile_id]?.full_name ?? '—'
    const base = {
      employee_id: e.id,
      employee_name: name,
      employee_code: e.employee_code ?? undefined,
      designation: e.designation ?? undefined,
      department: e.department ?? undefined,
      bank_account: e.bank_account ?? undefined,
      month,
      year,
      attendance: attSummary[e.id],
    }
    if (p) {
      return {
        ...base,
        id: p.id,
        generated: true as const,
        basic: p.basic,
        hra: p.hra,
        allowances: p.allowances,
        incentive: p.incentive,
        gross: p.gross,
        pf: p.pf,
        tds: p.tds,
        other_deductions: p.other_deductions,
        leave_deduction: p.leave_deduction,
        advance_deduction: p.advance_deduction,
        net: p.net,
        status: p.status as 'draft' | 'processed' | 'paid',
        payment_date: p.payment_date,
      }
    }
    // Not generated yet — show base salary from the employee's structure
    const basic = num(e.basic_salary)
    const hra = num(e.hra)
    const allowances = num(e.allowances)
    const pf = num(e.pf_deduction)
    const tds = num(e.tds_deduction)
    const od = num(e.other_deductions)
    const gross = basic + hra + allowances
    return {
      ...base,
      id: `pending-${e.id}`,
      generated: false as const,
      basic,
      hra,
      allowances,
      incentive: 0,
      gross,
      pf,
      tds,
      other_deductions: od,
      leave_deduction: 0,
      advance_deduction: 0,
      net: gross - pf - tds - od,
      status: 'draft' as const,
      payment_date: null,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            {' · '}{rows.length} employee{rows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <PayrollMonthSelector month={month} year={year} />
      </div>
      <PayrollTable data={rows} isAdmin={profile.role === 'admin'} />
    </div>
  )
}

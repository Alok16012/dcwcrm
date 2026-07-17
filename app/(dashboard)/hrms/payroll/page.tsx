import { redirect } from 'next/navigation'
import { format, getMonth, getYear } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
import PayrollTable from '@/components/hrms/PayrollTable'
import PayrollMonthSelector from '@/components/hrms/PayrollMonthSelector'

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

  const { data: payRaw, error } = await supabase
    .from('payroll')
    .select('id, employee_id, month, year, basic, hra, allowances, incentive, gross, pf, tds, other_deductions, leave_deduction, advance_deduction, net, status, payment_date')
    .eq('month', month)
    .eq('year', year)
    .order('employee_id')

  if (error) {
    return <div className="p-4 text-red-500">Failed to load payroll: {error.message}</div>
  }

  type RawPayroll = { id: string; employee_id: string; month: number; year: number; basic: number; hra: number; allowances: number; incentive: number; gross: number; pf: number; tds: number; other_deductions: number; leave_deduction: number; advance_deduction: number; net: number; status: string; payment_date: string | null }
  const payrollData = payRaw as RawPayroll[] | null

  // Fetch employee names + details
  const empIds = (payrollData ?? []).map((p) => p.employee_id)
  const { data: empsRaw } = empIds.length > 0
    ? await supabase.from('employees').select('id, profile_id, employee_code, designation, department, bank_account, salary_cycle_start_day').in('id', empIds)
    : { data: [] }

  type EmpRaw = { id: string; profile_id: string; employee_code: string | null; designation: string | null; department: string | null; bank_account: string | null; salary_cycle_start_day: number | null }
  const emps = (empsRaw ?? []) as EmpRaw[]
  const empMap = Object.fromEntries(emps.map((e) => [e.id, e]))

  // Attendance breakdown per employee for the selected cycle
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

  const profileIds = emps.map((e) => e.profile_id).filter(Boolean)
  const { data: profsRaw } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
    : { data: [] }
  const profNameMap = Object.fromEntries(((profsRaw ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]))

  const rows = (payrollData ?? []).map((p) => {
    const emp = empMap[p.employee_id]
    return {
      id: p.id,
      employee_id: p.employee_id,
      employee_name: profNameMap[emp?.profile_id] ?? '—',
      employee_code: emp?.employee_code ?? undefined,
      designation: emp?.designation ?? undefined,
      department: emp?.department ?? undefined,
      bank_account: emp?.bank_account ?? undefined,
      month: p.month,
      year: p.year,
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
      attendance: attSummary[p.employee_id],
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <PayrollMonthSelector month={month} year={year} />
      </div>
      <PayrollTable data={rows} isAdmin={profile.role === 'admin'} />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { getMonth, getYear } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
import PayrollTable from '@/components/hrms/PayrollTable'
import PayrollMonthSelector from '@/components/hrms/PayrollMonthSelector'

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string }
}) {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  const now = new Date()
  const month = Number(searchParams.month ?? getMonth(now) + 1)
  const year = Number(searchParams.year ?? getYear(now))

  const { data: payRaw, error } = await supabase
    .from('payroll')
    .select('id, employee_id, month, year, basic, hra, allowances, incentive, gross, pf, tds, other_deductions, leave_deduction, net, status, payment_date')
    .eq('month', month)
    .eq('year', year)
    .order('employee_id')

  if (error) {
    return <div className="p-4 text-red-500">Failed to load payroll: {error.message}</div>
  }

  type RawPayroll = { id: string; employee_id: string; month: number; year: number; basic: number; hra: number; allowances: number; incentive: number; gross: number; pf: number; tds: number; other_deductions: number; leave_deduction: number; net: number; status: string; payment_date: string | null }
  const payrollData = payRaw as RawPayroll[] | null

  // Fetch employee names + details
  const empIds = (payrollData ?? []).map((p) => p.employee_id)
  const { data: empsRaw } = empIds.length > 0
    ? await supabase.from('employees').select('id, profile_id, employee_code, designation, department, bank_account').in('id', empIds)
    : { data: [] }

  type EmpRaw = { id: string; profile_id: string; employee_code: string | null; designation: string | null; department: string | null; bank_account: string | null }
  const emps = (empsRaw ?? []) as EmpRaw[]
  const empMap = Object.fromEntries(emps.map((e) => [e.id, e]))

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
      net: p.net,
      status: p.status as 'draft' | 'processed' | 'paid',
      payment_date: p.payment_date,
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

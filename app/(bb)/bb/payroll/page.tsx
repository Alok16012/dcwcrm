import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { asLoose } from '@/lib/bb/db'
import { isBbManagerRole } from '@/lib/bb/constants'
import PayrollClient, { type PayrollStaff } from '@/components/bb/PayrollClient'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic'

export default async function BbPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const supabase = await createServerClient()
  const db = asLoose(supabase)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user!.id).single()) as { data: { role: string } | null }

  if (!isBbManagerRole(profile?.role)) redirect('/bb/dashboard')

  const sp = await searchParams
  const now = new Date()
  const month = Number(sp.month ?? now.getMonth() + 1)
  const year = Number(sp.year ?? now.getFullYear())

  const [employeesRes, payrollRes] = await Promise.all([
    db.from('bb_employees').select('*').eq('is_active', true),
    db.from('bb_payroll').select('*').eq('month', month).eq('year', year),
  ])

  const employees = (employeesRes.data ?? []) as any[]
  const profileIds = employees.map(e => e.profile_id)
  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
    : { data: [] }
  const nameById = Object.fromEntries(((profiles ?? []) as any[]).map(p => [p.id, p.full_name]))

  const payrollByEmployee = Object.fromEntries(
    ((payrollRes.data ?? []) as any[]).map(p => [p.employee_id, p])
  )

  const staff: PayrollStaff[] = employees
    .map(e => ({
      employee_id: e.id,
      name: nameById[e.profile_id] ?? e.employee_code,
      employee_code: e.employee_code,
      designation: e.designation,
      joining_date: e.joining_date,
      bank_account: e.bank_account,
      bank_name: e.bank_name,
      monthly: Number(e.basic_salary) + Number(e.hra) + Number(e.allowances),
      payroll: payrollByEmployee[e.id] ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Salary, loss of pay from attendance, and placement incentive
        </p>
      </div>
      <PayrollClient staff={staff} month={month} year={year} canEdit={isBbManagerRole(profile?.role)} />
    </div>
  )
}

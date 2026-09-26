import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { asLoose } from '@/lib/bb/db'
import { isBbManagerRole, BB_ROLES } from '@/lib/bb/constants'
import TeamClient, { type TeamMember } from '@/components/bb/TeamClient'

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const supabase = await createServerClient()
  const db = asLoose(supabase)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user!.id).single()) as { data: { role: string } | null }

  if (!isBbManagerRole(profile?.role)) redirect('/bb/dashboard')

  const [profilesRes, employeesRes, placementsRes] = await Promise.all([
    supabase.from('profiles')
      .select('id, full_name, email, phone, role, is_active')
      .in('role', BB_ROLES as unknown as string[])
      .order('full_name'),
    db.from('bb_employees').select('*'),
    db.from('bb_placements').select('credited_to'),
  ])

  const employeeByProfile = Object.fromEntries(
    ((employeesRes.data ?? []) as any[]).map(e => [e.profile_id, e])
  )
  const placementCount = ((placementsRes.data ?? []) as any[]).reduce<Record<string, number>>((acc, p) => {
    if (p.credited_to) acc[p.credited_to] = (acc[p.credited_to] ?? 0) + 1
    return acc
  }, {})

  const members: TeamMember[] = ((profilesRes.data ?? []) as any[]).map(p => {
    const e = employeeByProfile[p.id] ?? {}
    return {
      profile_id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      role: p.role,
      is_active: p.is_active,
      employee_id: e.id ?? null,
      employee_code: e.employee_code ?? null,
      designation: e.designation ?? null,
      department: e.department ?? null,
      joining_date: e.joining_date ?? null,
      basic_salary: Number(e.basic_salary ?? 0),
      hra: Number(e.hra ?? 0),
      allowances: Number(e.allowances ?? 0),
      pf_deduction: Number(e.pf_deduction ?? 0),
      tds_deduction: Number(e.tds_deduction ?? 0),
      other_deductions: Number(e.other_deductions ?? 0),
      incentive_per_placement: Number(e.incentive_per_placement ?? 0),
      incentive_percent_of_commission: Number(e.incentive_percent_of_commission ?? 0),
      bank_account: e.bank_account ?? null,
      bank_ifsc: e.bank_ifsc ?? null,
      bank_name: e.bank_name ?? null,
      salary_cycle_start_day: Number(e.salary_cycle_start_day ?? 1),
      placements: placementCount[p.id] ?? 0,
    }
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <p className="text-sm text-gray-500 mt-0.5">Berojgar Bharat staff, their salary and incentive</p>
      </div>
      <TeamClient members={members} />
    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

type ExistingPayroll = {
    id: string
    incentive: number | null
    status: string | null
}

type ProfileRole = {
    role: string | null
}

type EmployeeSalary = {
    basic_salary: number | null
    hra: number | null
    allowances: number | null
    pf_deduction: number | null
    tds_deduction: number | null
    other_deductions: number | null
    salary_cycle_start_day: number | null
    profile_id: string
}

type AttendanceRow = {
    status: string | null
}

type StudentIncentiveRow = {
    incentive_amount: number | null
}

type GeneratePayrollBody = {
    employee_id?: string
    month?: number
    year?: number
    incentive?: number | string | null
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as { data: ProfileRole | null }
        if (!['admin', 'backend'].includes(profile?.role ?? '')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const body = await req.json() as GeneratePayrollBody
        const { employee_id, month, year, incentive } = body

        if (!employee_id || !month || !year) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Fetch employee structured salary and cycle preference
        const empRes = await supabase
            .from('employees')
            .select('basic_salary, hra, allowances, pf_deduction, tds_deduction, other_deductions, salary_cycle_start_day, profile_id')
            .eq('id', employee_id)
            .single()
        const emp = empRes.data as EmployeeSalary | null
        const empErr = empRes.error

        if (empErr || !emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

        const basic = emp.basic_salary || 0
        const hra = emp.hra || 0
        const allow = emp.allowances || 0
        const pf = emp.pf_deduction || 0
        const tds = emp.tds_deduction || 0
        const od = emp.other_deductions || 0
        const startDay = emp.salary_cycle_start_day || 1
        let startDate: Date;
        let endDate: Date;

        if (startDay === 1) {
            startDate = new Date(year, month - 1, 1)
            endDate = new Date(year, month, 0)
        } else {
            // e.g. if month is March (3), startDay is 15
            // startDate is Feb 15th, endDate is March 14th
            startDate = new Date(year, month - 2, startDay)
            endDate = new Date(year, month - 1, startDay - 1)
        }

        // Fetch attendance for this range
        const { data: attendance } = await supabase
            .from('attendance')
            .select('status')
            .eq('employee_id', employee_id)
            .gte('date', startDate.toISOString().split('T')[0])
            .lte('date', endDate.toISOString().split('T')[0])

        const attendanceRows = (attendance ?? []) as AttendanceRow[]
        const absentCount = attendanceRows.filter(a => a.status === 'absent' || a.status === 'leave').length
        const leaveDeduction = Math.round((basic / 26) * absentCount)

        // Fetch incentives for this range
        const { data: studentIncentives } = await supabase
            .from('students')
            .select('incentive_amount')
            .eq('assigned_counsellor', emp.profile_id)
            .gte('enrollment_date', startDate.toISOString().split('T')[0])
            .lte('enrollment_date', endDate.toISOString().split('T')[0])

        const studentIncentiveRows = (studentIncentives ?? []) as StudentIncentiveRow[]
        const calculatedIncentive = studentIncentiveRows.reduce((acc, s) => acc + (Number(s.incentive_amount) || 0), 0)
        const cycleStudentIncentive = calculatedIncentive || Number(incentive) || 0

        const inc = cycleStudentIncentive

        const gross = basic + hra + allow + inc
        const net = gross - pf - tds - od - leaveDeduction

        const { data: existing } = await supabase
            .from('payroll')
            .select('id, incentive, status')
            .eq('employee_id', employee_id)
            .eq('month', month)
            .eq('year', year)
            .maybeSingle() as { data: ExistingPayroll | null }

        if (existing) {
            if (existing.status === 'paid') {
                return NextResponse.json({ error: 'Payroll already paid for this month' }, { status: 400 })
            }

            const existingIncentive = Number(existing.incentive ?? 0)
            const mergedIncentive = existingIncentive >= cycleStudentIncentive
                ? existingIncentive
                : existingIncentive + cycleStudentIncentive
            const mergedGross = basic + hra + allow + mergedIncentive
            const mergedNet = mergedGross - pf - tds - od - leaveDeduction

            const { data: updated, error: updateErr } = await supabase
                .from('payroll')
                .update({
                    basic,
                    hra,
                    allowances: allow,
                    incentive: mergedIncentive,
                    gross: mergedGross,
                    pf,
                    tds,
                    other_deductions: od,
                    leave_deduction: leaveDeduction,
                    net: mergedNet,
                    status: existing.status || 'draft'
                } as never)
                .eq('id', existing.id)
                .select('*')
                .single()

            if (updateErr) {
                return NextResponse.json({ error: updateErr.message }, { status: 400 })
            }

            return NextResponse.json({ payroll: updated })
        }

        const { data: inserted, error: insertErr } = await supabase
            .from('payroll')
            .insert({
                employee_id,
                month,
                year,
                basic,
                hra,
                allowances: allow,
                incentive: inc,
                gross,
                pf,
                tds,
                other_deductions: od,
                leave_deduction: leaveDeduction,
                net,
                status: 'draft'
            } as never)
            .select('*')
            .single()

        if (insertErr) {
            if (insertErr.code === '23505') {
                return NextResponse.json({ error: 'Payroll already generated for this month' }, { status: 400 })
            }
            return NextResponse.json({ error: insertErr.message }, { status: 400 })
        }

        return NextResponse.json({ payroll: inserted })
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

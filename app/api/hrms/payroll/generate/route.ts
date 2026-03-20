import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single() as { data: any }
        if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const body = await req.json()
        const { employee_id, month, year, incentive } = body

        if (!employee_id || !month || !year) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Fetch employee structured salary and cycle preference
        const { data: emp, error: empErr } = await supabase
            .from('employees')
            .select('basic_salary, hra, allowances, pf_deduction, tds_deduction, other_deductions, salary_cycle_start_day')
            .eq('id', employee_id)
            .single() as { data: any, error: any }

        if (empErr || !emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

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

        const absentCount = ((attendance as any[]) || []).filter(a => a.status === 'absent' || a.status === 'leave').length
        const leaveDeduction = Math.round((emp.basic_salary / 26) * absentCount)

        const basic = emp.basic_salary || 0
        const hra = emp.hra || 0
        const allow = emp.allowances || 0
        const inc = incentive || 0
        const pf = emp.pf_deduction || 0
        const tds = emp.tds_deduction || 0
        const od = emp.other_deductions || 0

        const gross = basic + hra + allow + inc
        const net = gross - pf - tds - od - leaveDeduction

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
            } as any)
            .select('*')
            .single()

        if (insertErr) {
            if (insertErr.code === '23505') {
                return NextResponse.json({ error: 'Payroll already generated for this month' }, { status: 400 })
            }
            return NextResponse.json({ error: insertErr.message }, { status: 400 })
        }

        return NextResponse.json({ payroll: inserted })
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

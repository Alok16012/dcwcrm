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

        // Fetch employee structured salary
        const { data: emp, error: empErr } = await supabase
            .from('employees')
            .select('basic_salary, hra, allowances, pf_deduction, tds_deduction, other_deductions')
            .eq('id', employee_id)
            .single() as { data: any, error: any }

        if (empErr || !emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

        const basic = emp.basic_salary || 0
        const hra = emp.hra || 0
        const allow = emp.allowances || 0
        const inc = incentive || 0
        const pf = emp.pf_deduction || 0
        const tds = emp.tds_deduction || 0
        const od = emp.other_deductions || 0

        const gross = basic + hra + allow + inc
        const net = gross - pf - tds - od

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
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

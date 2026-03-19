import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { employeeSchema } from '@/lib/validations/employee.schema'
import type { Database } from '@/types/database.types'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null }

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = employeeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const {
      full_name, email, phone, role,
      department, designation, joining_date,
      basic_salary, hra, allowances, pf_deduction, tds_deduction,
      bank_account_masked, bank_ifsc,
    } = parsed.data

    // Use service role client for creating auth users
    const adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Create auth user
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (authError || !authUser.user) {
      return NextResponse.json({ error: authError?.message ?? 'Failed to create auth user' }, { status: 500 })
    }

    const userId = authUser.user.id

    // 2. Insert profile
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: userId,
      full_name,
      email,
      phone,
      role,
      is_active: true,
    } as never)

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // 3. Insert employee record
    const { data: employee, error: empError } = await adminClient.from('employees').insert({
      profile_id: userId,
      department,
      designation,
      joining_date,
      basic_salary,
      hra,
      allowances,
      pf_deduction,
      tds_deduction,
      bank_account: bank_account_masked ?? null,
      bank_ifsc: bank_ifsc ?? null,
      is_active: true,
    } as never).select('*').single()

    if (empError) {
      return NextResponse.json({ error: empError.message }, { status: 500 })
    }

    return NextResponse.json({
      employee: { ...(employee as object), full_name, role },
      tempPassword,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

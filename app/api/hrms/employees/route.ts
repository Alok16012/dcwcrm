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
      bank_account_masked, bank_ifsc, salary_cycle_start_day,
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
      salary_cycle_start_day: salary_cycle_start_day ?? 1,
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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check role using adminClient to avoid recursion
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null }

    if (!profile || !['admin', 'backend'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 })
    }

    const { data: employee, error: fetchError } = await adminClient
      .from('employees')
      .select('*, profiles(full_name, email, phone, role)')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Fetch employee error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 404 })
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const profileData = Array.isArray((employee as any).profiles) ? (employee as any).profiles[0] : (employee as any).profiles

    const final = {
      ...(employee as any),
      full_name: profileData?.full_name || '—',
      role: profileData?.role || '—',
      email: profileData?.email || '',
      phone: profileData?.phone || '',
    }
    delete final.profiles

    return NextResponse.json({ employee: final })
  } catch (error) {
    console.error('GET employee error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check role using adminClient to avoid recursion
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null }

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...updateData } = body
    if (!id) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 })
    }

    const parsed = employeeSchema.partial().safeParse(updateData)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Get the employee to find their profile_id (use adminClient to bypass RLS)
    const { data: employee, error: fetchError } = await adminClient
      .from('employees')
      .select('profile_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch employee: ${fetchError.message}`)
    }
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const profileId = (employee as any).profile_id

    // Update Profile (use adminClient to bypass RLS)
    const profileUpdate: any = {}
    if (updateData.full_name) profileUpdate.full_name = updateData.full_name
    if (updateData.email) profileUpdate.email = updateData.email
    if (updateData.phone) profileUpdate.phone = updateData.phone
    if (updateData.role) profileUpdate.role = updateData.role

    if (Object.keys(profileUpdate).length > 0) {
      const { error: pError } = await (adminClient.from('profiles') as any)
        .update(profileUpdate)
        .eq('id', profileId)
      if (pError) {
        throw pError
      }
    }

    // Update Employee (use adminClient to bypass RLS)
    const empUpdate: any = {}
    if (updateData.department) empUpdate.department = updateData.department
    if (updateData.designation) empUpdate.designation = updateData.designation
    if (updateData.joining_date) empUpdate.joining_date = updateData.joining_date
    if (updateData.basic_salary !== undefined) empUpdate.basic_salary = updateData.basic_salary
    if (updateData.hra !== undefined) empUpdate.hra = updateData.hra
    if (updateData.allowances !== undefined) empUpdate.allowances = updateData.allowances
    if (updateData.pf_deduction !== undefined) empUpdate.pf_deduction = updateData.pf_deduction
    if (updateData.tds_deduction !== undefined) empUpdate.tds_deduction = updateData.tds_deduction
    if (updateData.bank_account_masked !== undefined) empUpdate.bank_account = updateData.bank_account_masked
    if (updateData.bank_ifsc !== undefined) empUpdate.bank_ifsc = updateData.bank_ifsc
    if (updateData.salary_cycle_start_day !== undefined) empUpdate.salary_cycle_start_day = updateData.salary_cycle_start_day

    if (Object.keys(empUpdate).length > 0) {
      const { error: eError } = await (adminClient.from('employees') as any)
        .update(empUpdate)
        .eq('id', id)
      if (eError) {
        throw eError
      }
    }

    // Fetch updated employee (use adminClient to bypass RLS)
    const { data: updated, error: uError } = await adminClient
      .from('employees')
      .select('*, profiles(full_name, role)')
      .eq('id', id)
      .single()

    if (uError) {
      throw uError
    }
    if (!updated) {
      throw new Error('Failed to fetch updated employee after update')
    }

    // Handle profile data (it might be an object or an array depending on PostgREST version/config)
    const profileData = updated ? (Array.isArray((updated as any).profiles) ? (updated as any).profiles[0] : (updated as any).profiles) : null

    const final = {
      ...(updated as any),
      full_name: profileData?.full_name || '—',
      role: profileData?.role || '—',
    }
    delete final.profiles

    return NextResponse.json({ employee: final })
  } catch (error: any) {
    console.error('Update employee overall error:', error)
    return NextResponse.json(
      {
        error: error?.message || 'Internal server error',
        stack: error?.stack
      },
      { status: 500 }
    )
  }
}

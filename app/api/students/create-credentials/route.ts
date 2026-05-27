import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const caller = await createServerClient()
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await caller.from('profiles').select('role').eq('id', user.id).single() as { data: any }
    if (!profile || !['admin', 'backend'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { student_id, password } = await request.json()
    if (!student_id || !password) {
      return NextResponse.json({ error: 'student_id and password are required' }, { status: 400 })
    }

    const { data: student, error: sErr } = await caller
      .from('students')
      .select('id, full_name, phone, email, enrollment_number, portal_user_id, portal_active')
      .eq('id', student_id)
      .single() as { data: any, error: any }

    if (sErr || !student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    if (student.portal_active && student.portal_user_id) {
      return NextResponse.json({ error: 'Portal credentials already exist. Use reset-password to change.' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Always use enrollment-derived email so login page can always derive it the same way
    const portalEmail = `${student.enrollment_number.toLowerCase().replace(/[^a-z0-9]/g, '')}@dcwportal.in`
    const username = student.enrollment_number

    if (student.portal_user_id) {
      await adminClient.auth.admin.deleteUser(student.portal_user_id)
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: portalEmail,
      password,
      email_confirm: true,
    })

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    await (adminClient as any).from('profiles').upsert({
      id: authData.user.id,
      email: portalEmail,
      full_name: student.full_name,
      role: 'student',
      phone: student.phone,
      is_active: true,
    })

    const { error: updateErr } = await (adminClient as any)
      .from('students')
      .update({
        portal_user_id: authData.user.id,
        portal_username: username,
        portal_temp_password: password,
        portal_active: true,
      })
      .eq('id', student_id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

    return NextResponse.json({ success: true, username, password, email: portalEmail })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

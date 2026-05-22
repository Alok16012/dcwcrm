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

    const { student_id, new_password } = await request.json()
    if (!student_id || !new_password) {
      return NextResponse.json({ error: 'student_id and new_password are required' }, { status: 400 })
    }

    const { data: student, error: sErr } = await caller
      .from('students')
      .select('portal_user_id, portal_active')
      .eq('id', student_id)
      .single() as { data: any, error: any }

    if (sErr || !student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    if (!student.portal_user_id) return NextResponse.json({ error: 'No portal account found' }, { status: 404 })

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error: passErr } = await adminClient.auth.admin.updateUserById(student.portal_user_id, {
      password: new_password,
    })
    if (passErr) return NextResponse.json({ error: passErr.message }, { status: 400 })

    await (adminClient as any).from('students').update({ portal_temp_password: new_password }).eq('id', student_id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

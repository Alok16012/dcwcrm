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

    const { student_id } = await request.json()
    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 })
    }

    const { data: student, error: sErr } = await caller
      .from('students')
      .select('id, portal_user_id')
      .eq('id', student_id)
      .single() as { data: any, error: any }

    if (sErr || !student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    if (student.portal_user_id) {
      const { error: delErr } = await adminClient.auth.admin.deleteUser(student.portal_user_id)
      if (delErr) {
        console.error('Failed to delete auth user:', delErr.message)
        // proceed to nullify anyway so admin can recreate if needed
      }
    }

    const { error: updateErr } = await (adminClient as any)
      .from('students')
      .update({
        portal_user_id: null,
        portal_username: null,
        portal_temp_password: null,
        portal_active: false,
      })
      .eq('id', student_id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('delete-portal error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

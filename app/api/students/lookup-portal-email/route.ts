import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { enrollment_number } = await request.json()
    if (!enrollment_number) {
      return NextResponse.json({ error: 'enrollment_number required', code: 'MISSING_INPUT' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const query = enrollment_number.trim()

    // Try portal_username first (exact case-insensitive), then fall back to enrollment_number field
    let student: { portal_user_id: string | null; portal_active: boolean } | null = null

    const { data: byUsername } = await (adminClient as any)
      .from('students')
      .select('portal_user_id, portal_active')
      .ilike('portal_username', query)
      .maybeSingle()

    if (byUsername?.portal_user_id) {
      student = byUsername
    } else {
      const { data: byEnrollment } = await (adminClient as any)
        .from('students')
        .select('portal_user_id, portal_active')
        .ilike('enrollment_number', query)
        .maybeSingle()
      if (byEnrollment?.portal_user_id) {
        student = byEnrollment
      }
    }

    if (!student) {
      return NextResponse.json({ error: 'No student found with this enrollment number', code: 'NOT_FOUND' }, { status: 404 })
    }

    if (!student.portal_active) {
      return NextResponse.json({ error: 'Portal access has not been activated for this account. Please contact your counsellor.', code: 'INACTIVE' }, { status: 403 })
    }

    if (!student.portal_user_id) {
      return NextResponse.json({ error: 'Portal credentials not created yet. Please contact your counsellor.', code: 'NO_CREDENTIALS' }, { status: 404 })
    }

    // Get the actual auth email using admin client — most reliable source
    const { data: { user: authUser }, error: authErr } = await adminClient.auth.admin.getUserById(student.portal_user_id)

    if (authErr || !authUser?.email) {
      return NextResponse.json({ error: 'Could not retrieve account details. Please contact your counsellor.', code: 'AUTH_NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ email: authUser.email })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error: ' + (e?.message ?? 'unknown'), code: 'SERVER_ERROR' }, { status: 500 })
  }
}

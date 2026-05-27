import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { enrollment_number } = await request.json()
    if (!enrollment_number) {
      return NextResponse.json({ error: 'enrollment_number required' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const query = enrollment_number.trim()

    // Try exact match first, then case-insensitive
    const { data: student } = await (adminClient as any)
      .from('students')
      .select('portal_user_id, portal_active')
      .ilike('portal_username', query)
      .eq('portal_active', true)
      .single()

    if (!student?.portal_user_id) {
      return NextResponse.json({ error: 'No portal account found' }, { status: 404 })
    }

    // Get the actual login email from the profiles table
    const { data: profile } = await (adminClient as any)
      .from('profiles')
      .select('email')
      .eq('id', student.portal_user_id)
      .single()

    if (!profile?.email) {
      return NextResponse.json({ error: 'Account email not found' }, { status: 404 })
    }

    return NextResponse.json({ email: profile.email })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

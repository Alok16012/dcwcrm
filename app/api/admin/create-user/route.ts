import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/supabase/guard'

export async function POST(request: NextRequest) {
  try {
    const caller = await requireRole(['admin', 'backend'])
    if (caller instanceof NextResponse) return caller

    const body = await request.json()
    const { full_name, email, password, role, phone } = body
    const username = body.username ? String(body.username).trim().toLowerCase() : null

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const { data: profileData, error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        role,
        phone: phone || null,
        username,
        is_active: true,
      })
      .select()
      .single()

    if (profileError) {
      // Don't leave an auth account behind that has no profile to sign in to.
      await adminClient.auth.admin.deleteUser(authData.user.id)
      const taken = profileError.code === '23505' && profileError.message.includes('username')
      return NextResponse.json({ error: taken ? 'That username is already taken' : profileError.message }, { status: 400 })
    }

    return NextResponse.json({ user: profileData })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { full_name, email, password, role, phone } = body

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
        is_active: true,
      })
      .select()
      .single()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ user: profileData })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

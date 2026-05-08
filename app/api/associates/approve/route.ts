import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function makePassword(length = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function nextAssociateCode(adminClient: any): Promise<string> {
  const { count } = await adminClient
    .from('associates')
    .select('*', { count: 'exact', head: true })
    .not('associate_code', 'is', null)
  const n = ((count ?? 0) + 1).toString().padStart(4, '0')
  return `ASC${n}`
}

export async function POST(request: NextRequest) {
  try {
    const { associate_id } = await request.json()
    if (!associate_id) return NextResponse.json({ error: 'associate_id required' }, { status: 400 })

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch associate
    const { data: assoc, error: fetchErr } = await adminClient
      .from('associates')
      .select('*')
      .eq('id', associate_id)
      .single()

    if (fetchErr || !assoc) return NextResponse.json({ error: 'Associate not found' }, { status: 404 })
    if (assoc.status === 'approved') return NextResponse.json({ error: 'Already approved' }, { status: 400 })

    const password = makePassword()
    const associate_code = await nextAssociateCode(adminClient)

    // Create Supabase auth user
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email: assoc.email,
      password,
      email_confirm: true,
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

    // Create profile
    await adminClient.from('profiles').insert({
      id: authData.user.id,
      email: assoc.email,
      full_name: assoc.name,
      role: 'associate',
      phone: assoc.phone,
      is_active: true,
    })

    // Update associate record (store temp_password so coordinator can share it)
    const { error: updateErr } = await adminClient
      .from('associates')
      .update({
        status: 'approved',
        associate_code,
        user_id: authData.user.id,
        temp_password: password,
        approved_at: new Date().toISOString(),
      })
      .eq('id', associate_id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

    // Send welcome notification
    await adminClient.from('associate_notifications').insert({
      associate_id,
      title: 'Welcome to DCW Associate Network!',
      message: `Your application has been approved. Your Associate Code is ${associate_code}. Use your email and the provided password to login.`,
    })

    return NextResponse.json({
      associate_code,
      email: assoc.email,
      password,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function makePassword(length = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
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
      .select('id, name, email, user_id, status')
      .eq('id', associate_id)
      .single()

    if (fetchErr || !assoc) return NextResponse.json({ error: 'Associate not found' }, { status: 404 })
    if (assoc.status !== 'approved') return NextResponse.json({ error: 'Associate not approved' }, { status: 400 })
    if (!assoc.user_id) return NextResponse.json({ error: 'No auth user linked to this associate' }, { status: 400 })

    const newPassword = makePassword()

    // Update Supabase auth password
    const { error: authErr } = await adminClient.auth.admin.updateUserById(assoc.user_id, {
      password: newPassword,
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

    // Store new temp_password in associates table
    const { error: updateErr } = await adminClient
      .from('associates')
      .update({ temp_password: newPassword })
      .eq('id', associate_id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

    // Send notification to associate
    await adminClient.from('associate_notifications').insert({
      associate_id,
      title: 'Password Reset',
      message: `Your login password has been reset by admin. New password: ${newPassword}. Please login and change it.`,
    })

    return NextResponse.json({ success: true, password: newPassword })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

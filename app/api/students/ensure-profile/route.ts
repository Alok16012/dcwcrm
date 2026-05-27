import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

// Called right after student login to ensure their profile row exists with role='student'
export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    // Check if profile already exists
    const { data: existing } = await (supabase as any)
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (existing?.role === 'student') {
      return NextResponse.json({ ok: true, action: 'already_exists' })
    }

    // Look up the student record to get their info
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: student } = await (adminClient as any)
      .from('students')
      .select('full_name, phone')
      .eq('portal_user_id', user.id)
      .maybeSingle()

    if (!student) {
      return NextResponse.json({ error: 'No student record linked to this account' }, { status: 404 })
    }

    // Create / repair the profile
    const { error: upsertErr } = await (adminClient as any).from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: student.full_name,
      role: 'student',
      phone: student.phone ?? null,
      is_active: true,
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: 'created' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}

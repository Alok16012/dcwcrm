/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Staff sign-in by username. The email behind the username is looked up and
 * used here, server-side, so it never reaches the browser; the session
 * cookies are set on this response just as a normal email sign-in sets them.
 * Every failure gives the same message, so this cannot be used to discover
 * which usernames exist.
 */
export async function POST(request: NextRequest) {
  const invalid = NextResponse.json({ error: 'Invalid login credentials' }, { status: 400 })
  try {
    const { username, password } = await request.json()
    const name = String(username ?? '').trim().toLowerCase()
    if (!name || !password) return invalid

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: profile } = await (adminClient as any)
      .from('profiles').select('email').eq('username', name).maybeSingle() as { data: { email: string } | null }
    if (!profile?.email) return invalid

    const supabase = await createServerClient()
    const { error } = await supabase.auth.signInWithPassword({ email: profile.email, password: String(password) })
    if (error) return invalid
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

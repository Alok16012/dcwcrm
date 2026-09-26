import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { BB_MANAGER_ROLES, BB_ROLES } from '@/lib/bb/constants'

/** Reset a Berojgar Bharat staff password. Returns the new one once. */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user.id).single()) as { data: { role: string } | null }
  if (!profile || !BB_MANAGER_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const profileId = String(body.profile_id ?? '')
  if (!profileId) return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  ) as any

  const { data: target } = await db.from('profiles').select('role').eq('id', profileId).single()
  if (!target || !(BB_ROLES as readonly string[]).includes(target.role)) {
    return NextResponse.json({ error: 'Not a Berojgar Bharat account' }, { status: 403 })
  }

  const password = String(body.password ?? '').trim() ||
    `Bb${randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, '')}#7`

  const { error } = await db.auth.admin.updateUserById(profileId, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, password })
}

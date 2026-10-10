import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * For API routes that act with the service role. The proxy lets every /api
 * request through untouched, so each such route must check the caller itself.
 * Returns the caller's id, or a 401/403 response to send back as-is.
 */
export async function requireRole(roles: string[]): Promise<{ userId: string } | NextResponse> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles').select('role, is_active').eq('id', user.id).single() as { data: { role: string; is_active: boolean } | null }
  if (!profile || !profile.is_active || !roles.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return { userId: user.id }
}

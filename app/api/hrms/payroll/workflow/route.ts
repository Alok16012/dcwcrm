import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { writeAudit } from '@/lib/hrms/audit'

/**
 * Payroll workflow steps: approve → lock → paid, and the audited unlock that
 * a correction needs (requirement doc §20, §27).
 */
export const runtime = 'nodejs'

type Db = { from: (t: string) => any }
type Action = 'approve' | 'lock' | 'unlock' | 'paid'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = (await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single()) as
    { data: { role: string; full_name: string } | null }
  if (!profile || !['admin', 'backend'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { ids?: string[]; action?: Action; reason?: string; paymentMode?: string; reference?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const ids = (body.ids ?? []).filter(Boolean)
  const action = body.action as Action
  if (ids.length === 0) return NextResponse.json({ error: 'No payroll rows selected' }, { status: 400 })
  if (!['approve', 'lock', 'unlock', 'paid'].includes(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  // Unlocking is the one step that always needs a written reason (§20, §29)
  if (action === 'unlock' && !body.reason?.trim()) {
    return NextResponse.json({ error: 'Unlock ke liye reason likhna zaroori hai' }, { status: 400 })
  }
  if (action === 'unlock' && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Sirf admin payroll unlock kar sakta hai' }, { status: 403 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as unknown as Db

  const now = new Date().toISOString()
  const patch: Record<string, unknown> =
    action === 'approve' ? { status: 'processed', approved_by: user.id, approved_at: now }
    : action === 'lock'   ? { is_locked: true, locked_by: user.id, locked_at: now }
    : action === 'unlock' ? { is_locked: false, locked_by: null, locked_at: null, remarks: body.reason!.trim() }
    : { status: 'paid', payment_date: now.slice(0, 10), payment_mode: body.paymentMode ?? null, payment_reference: body.reference ?? null }

  // The DB trigger refuses edits to a locked row, so unlock it first
  if (action === 'unlock') {
    const { error } = await db.from('payroll')
      .update({ is_locked: false, locked_by: null, locked_at: null, remarks: body.reason!.trim() })
      .in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await db.from('payroll').update(patch).in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAudit(db as never, {
    entity: 'payroll', entityId: ids.join(','), action,
    newValue: patch, reason: body.reason?.trim() ?? null,
    changedBy: user.id, changedByName: profile.full_name,
  })

  return NextResponse.json({ ok: true, action, count: ids.length })
}

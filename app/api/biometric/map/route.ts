import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { recomputeAttendance } from '@/lib/biometric/ingest'

/**
 * Bind a device identity (UserID / card number) to an employee.
 *
 * Punches that arrived before the mapping existed are backfilled here, so an
 * employee enrolled on the controller on Monday and mapped on Wednesday still
 * gets Monday's and Tuesday's attendance.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = (await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()) as { data: { role: string } | null }

  if (!profile || !['admin', 'backend'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    employee_id?: string
    biometric_user_id?: string | null
    biometric_card_no?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.employee_id) {
    return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })
  }

  const userId = body.biometric_user_id?.trim() || null
  const cardNo = body.biometric_card_no?.trim() || null

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: updateErr } = await admin
    .from('employees')
    .update({
      biometric_user_id: userId,
      biometric_card_no: cardNo,
      biometric_enrolled_at: userId || cardNo ? new Date().toISOString() : null,
    } as never)
    .eq('id', body.employee_id)

  if (updateErr) {
    // A duplicate here means the same UserID is already on another employee —
    // worth saying plainly, because it silently steals their attendance.
    const message = updateErr.message.includes('duplicate')
      ? 'That biometric User ID is already mapped to another employee'
      : updateErr.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (!userId && !cardNo) {
    return NextResponse.json({ ok: true, backfilled: 0 })
  }

  // Claim the orphan punches this mapping now explains.
  const orFilters = [
    ...(userId ? [`biometric_user_id.eq.${userId}`] : []),
    ...(cardNo ? [`card_no.eq.${cardNo}`] : []),
  ].join(',')

  const { data: claimed } = await admin
    .from('biometric_punches')
    .update({ employee_id: body.employee_id } as never)
    .is('employee_id', null)
    .or(orFilters)
    .select('punch_date')

  const dates = [
    ...new Set(((claimed ?? []) as { punch_date: string }[]).map(r => r.punch_date)),
  ]

  for (const date of dates) {
    await recomputeAttendance(admin, body.employee_id, date)
  }

  return NextResponse.json({ ok: true, backfilled: claimed?.length ?? 0, days: dates.length })
}

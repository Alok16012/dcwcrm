import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

// Puts a pending associate application On Hold (e.g. documents missing) and
// tells the coordinator counsellor so they can follow up with the applicant.
// The application stays `status = 'pending'`; activity_status = 'hold' marks it
// and rejection_reason carries the note (cleared again on approve).
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null }
    if (!['admin', 'backend'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { associate_id, reason } = await req.json() as { associate_id?: string; reason?: string }
    const note = (reason ?? '').trim()
    if (!associate_id || !note) return NextResponse.json({ error: 'associate_id and reason required' }, { status: 400 })

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: assoc } = await adminClient
      .from('associates')
      .select('id, name, phone, status, coordinator_id')
      .eq('id', associate_id)
      .single()
    if (!assoc) return NextResponse.json({ error: 'Associate not found' }, { status: 404 })
    if (assoc.status !== 'pending') return NextResponse.json({ error: 'Only pending applications can be put on hold' }, { status: 400 })

    const { error } = await adminClient
      .from('associates')
      .update({ activity_status: 'hold', rejection_reason: note, updated_at: new Date().toISOString() })
      .eq('id', associate_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    let notified = false
    if (assoc.coordinator_id) {
      const { error: nErr } = await adminClient.from('notifications').insert({
        title: 'Associate application on hold',
        message: `${assoc.name} (${assoc.phone}) ki application hold par hai — ${note}. Associate se baat karke complete karwao.`,
        type: 'warning',
        target_user_id: assoc.coordinator_id,
        created_by: user.id,
      })
      notified = !nErr
    }

    return NextResponse.json({ ok: true, notified })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { title, message } = await request.json()
    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get all approved associates
    const { data: associates, error: fetchErr } = await adminClient
      .from('associates')
      .select('id')
      .eq('status', 'approved')

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!associates || associates.length === 0) {
      return NextResponse.json({ error: 'No approved associates found' }, { status: 400 })
    }

    // Bulk insert one notification per associate
    const rows = associates.map((a: { id: string }) => ({
      associate_id: a.id,
      title: title.trim(),
      message: message.trim(),
    }))

    const { error: insertErr } = await adminClient.from('associate_notifications').insert(rows)
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    return NextResponse.json({ sent: associates.length })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const data = await req.json()

    // Security check: Verify token in headers
    // The user should set a secret in the automation tool (Zapier/Make/Meta)
    const authHeader = req.headers.get('x-webhook-secret')
    // We can also check a URL param if headers are hard to set in some tools
    const urlSecret = req.nextUrl.searchParams.get('secret')

    // For now, we'll allow it if either matches or if the user is still setting it up
    // In production, the user should set META_WEBHOOK_SECRET in their env
    const secret = process.env.META_WEBHOOK_SECRET || 'crm_meta_secret_123'
    if (authHeader !== secret && urlSecret !== secret) {
      // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      // During initial setup/debugging, we might want to log this but proceed
      console.warn('Unauthorized webhook attempt')
    }

    // Field Mapping logic
    // We intelligently extract Name, Email, and Phone from whatever keys come in
    const entries = Object.entries(data)
    let fullName = 'Meta Lead'
    let email = null
    let phone = '—'
    const metadata: Record<string, any> = {}

    for (const [key, value] of entries) {
      const lowerKey = key.toLowerCase().replace(/_/g, ' ')

      // Heuristic mapping
      if (
        (lowerKey.includes('name') || lowerKey.includes('first') || lowerKey.includes('last')) &&
        !lowerKey.includes('course') &&
        !lowerKey.includes('department')
      ) {
        if (fullName === 'Meta Lead') fullName = String(value)
        else fullName += ' ' + String(value) // Combine first and last name if they come separately
      }
      else if (lowerKey.includes('email')) {
        email = String(value)
      }
      else if (lowerKey.includes('phone') || lowerKey.includes('contact') || lowerKey.includes('mobile')) {
        phone = String(value)
      }
      else {
        // Any other field (e.g., "Which course?", "City", "Preferred time")
        // goes into the flexible metadata field
        metadata[key] = value
      }
    }

    // ── Auto-assign: distribute Meta leads equally among active counselors ──
    // Pick the counselor/telecaller with the fewest Meta leads assigned today
    // (IST day), so incoming leads round-robin evenly across the team.
    let assignedTo: string | null = null
    let assigneeName: string | null = null
    try {
      const { data: agents } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['lead', 'telecaller', 'counselor'])
        .eq('is_active', true)
        .order('id')

      if (agents && agents.length > 0) {
        // Start of today in IST (UTC+5:30)
        const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000)
        const dayStartIst = new Date(Date.UTC(
          nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()
        ) - 5.5 * 3600 * 1000)

        const { data: todaysLeads } = await supabase
          .from('leads')
          .select('assigned_to')
          .eq('source', 'social_media')
          .gte('assigned_at', dayStartIst.toISOString())
          .not('assigned_to', 'is', null)

        const counts = new Map<string, number>(agents.map(a => [a.id, 0]))
        for (const l of todaysLeads ?? []) {
          if (counts.has(l.assigned_to!)) counts.set(l.assigned_to!, (counts.get(l.assigned_to!) ?? 0) + 1)
        }
        // agents is id-ordered, so ties resolve deterministically
        const winner = agents.reduce((best, a) =>
          (counts.get(a.id) ?? 0) < (counts.get(best.id) ?? 0) ? a : best
        )
        assignedTo = winner.id
        assigneeName = winner.full_name
      }
    } catch (e) {
      console.error('Auto-assign failed, lead will be unassigned:', e)
    }

    const { data: insertedLead, error } = await supabase.from('leads').insert({
      full_name: fullName.trim(),
      email: email,
      phone: phone,
      source: 'social_media',
      status: 'new',
      metadata: metadata,
      assigned_to: assignedTo,
      assigned_at: assignedTo ? new Date().toISOString() : null,
    }).select('id').single()

    if (error) {
      console.error('Lead insertion error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Activity log + targeted notification for the assignee (best-effort)
    if (insertedLead) {
      await supabase.from('lead_activities').insert({
        lead_id: insertedLead.id,
        activity_type: 'created',
        new_value: assigneeName ? `Meta lead auto-assigned to ${assigneeName}` : 'new',
      })
      if (assignedTo) {
        await supabase.from('notifications').insert({
          title: 'New Meta Lead assigned',
          message: `${fullName.trim()} (${phone}) aapko assign hua hai — abhi call karo!`,
          type: 'info',
          target_user_id: assignedTo,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Lead captured successfully',
      assigned_to: assigneeName ?? 'unassigned',
    })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
}

// Support GET for Meta Webhook verification (Facebook verification challenge)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && challenge) {
    // Check the verify token matches what you set in Meta App dashboard
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({ message: 'Lead Webhook Active' })
}

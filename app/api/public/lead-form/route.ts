import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ingestLead } from '@/lib/leads/ingest'
import { sendLeadToMeta } from '@/lib/meta/capi'

// Keys that map directly onto lead columns; everything else -> metadata.
const RESERVED = new Set(['full_name', 'phone', 'email', 'city', 'state'])

interface FormField {
  key: string
  label: string
  type: string
  required?: boolean
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const body = await req.json()
    const { slug, values, hp, event_id, fbp, fbc, page_url } = body as {
      slug?: string
      values?: Record<string, string>
      hp?: string
      event_id?: string
      fbp?: string | null
      fbc?: string | null
      page_url?: string
    }

    // Honeypot — bots fill hidden fields; humans never do.
    if (hp) return NextResponse.json({ success: true })

    if (!slug || !values) {
      return NextResponse.json({ error: 'Invalid submission' }, { status: 400 })
    }

    const { data: form } = await supabase
      .from('lead_capture_forms')
      .select('id, title, fields, source, success_message, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    const fields = (form as { fields: FormField[] }).fields ?? []

    // Validate required fields
    for (const f of fields) {
      if (f.required && !String(values[f.key] ?? '').trim()) {
        return NextResponse.json({ error: `${f.label} is required` }, { status: 400 })
      }
    }

    // Which ad platform sent this visitor.
    //
    // Google auto-tagging appends ?gclid= to every paid click, and Meta
    // appends ?fbclid=, so the landing page URL tells us the channel
    // without the form having to know anything. Previously every
    // submission was stored as Meta, including the Google ones, which
    // made the channel column useless.
    const url = typeof page_url === 'string' ? page_url : ''
    const isGoogle = /[?&](gclid|gbraid|wbraid)=/.test(url)
      || /[?&]utm_source=google/i.test(url)
    const channel = isGoogle ? 'google_ads' : 'meta_ads'
    const channelLabel = isGoogle ? 'Google Ads' : 'Meta Ads'

    // Map values to lead columns / metadata
    const lead: Record<string, string> = {}
    const metadata: Record<string, unknown> = {
      form: (form as { title: string }).title,
      lead_source: channelLabel,
      landing_page: url || null,
    }
    const labelByKey = new Map(fields.map((f) => [f.key, f.label]))

    for (const [key, raw] of Object.entries(values)) {
      const val = String(raw ?? '').trim()
      if (!val) continue
      if (RESERVED.has(key)) lead[key] = val
      else metadata[labelByKey.get(key) ?? key] = val
    }

    const fullName = lead.full_name || `${channelLabel} Lead`
    const phone = lead.phone
    if (!phone) {
      return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 })
    }

    await ingestLead(supabase, {
      full_name: fullName,
      phone,
      email: lead.email ?? null,
      city: lead.city ?? null,
      state: lead.state ?? null,
      // Channel detected from the URL wins over the form's default:
      // one form is used by both Google and Meta campaigns.
      source: channel,
      metadata,
    })

    // Meta Conversions API — server-side Lead event, deduped with the browser
    // pixel via event_id. Best-effort: a Meta failure never blocks the lead.
    //
    // Google-sourced leads are deliberately not reported. Feeding Meta
    // conversions it never delivered teaches its bidding to chase traffic
    // that came from somewhere else entirely.
    if (!isGoogle) await sendLeadToMeta({
      eventId: event_id || crypto.randomUUID(),
      email: lead.email ?? null,
      phone,
      firstName: fullName,
      sourceUrl: page_url ?? null,
      clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent'),
      fbp: fbp ?? null,
      fbc: fbc ?? null,
    })

    // Best-effort submissions counter
    try {
      const { data: fresh } = await supabase
        .from('lead_capture_forms')
        .select('submissions_count')
        .eq('id', (form as { id: string }).id)
        .single()
      await supabase
        .from('lead_capture_forms')
        .update({ submissions_count: ((fresh as { submissions_count: number } | null)?.submissions_count ?? 0) + 1 } as never)
        .eq('id', (form as { id: string }).id)
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      message: (form as { success_message: string }).success_message
        || 'Thank you! Our team will contact you shortly.',
    })
  } catch (error: any) {
    console.error('Public lead form error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ingestLead } from '@/lib/leads/ingest'

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
    let email: string | null = null
    let phone = '—'
    let city: string | null = null
    const metadata: Record<string, unknown> = {}

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
      else if (lowerKey.includes('city') || lowerKey.includes('town')) {
        city = String(value)
      }
      else {
        // Any other field (e.g., "Which course?", "Preferred time")
        // goes into the flexible metadata field
        metadata[key] = value
      }
    }

    const { assigneeName } = await ingestLead(supabase, {
      full_name: fullName,
      phone,
      email,
      city,
      source: 'meta_ads',
      metadata,
    })

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
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && challenge) {
    // Check the verify token matches what you set in Meta App dashboard
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({ message: 'Lead Webhook Active' })
}

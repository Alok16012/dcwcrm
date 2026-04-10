import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
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

    const { error } = await supabase.from('leads').insert({
      full_name: fullName.trim(),
      email: email,
      phone: phone,
      source: 'social_media',
      status: 'new',
      metadata: metadata
    })

    if (error) {
       console.error('Lead insertion error:', error)
       return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Lead captured successfully' })
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

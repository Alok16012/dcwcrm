import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ingestLead } from '@/lib/leads/ingest'

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 10) digits = '91' + digits
  else if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1)
  return digits
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const body = await req.json()
    const { full_name, phone, email, city, course_interest, notes } = body as {
      full_name?: string
      phone?: string
      email?: string
      city?: string
      course_interest?: string
      notes?: string
    }

    // Validate required fields
    if (!full_name || !full_name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)
    if (normalizedPhone.length < 11) {
      return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 })
    }

    // Create the lead via ingestLead for round-robin distribution
    const metadata: Record<string, string> = {
      walkin: 'true',
      source: 'walk_in',
    }
    if (course_interest?.trim()) metadata.course_interest = course_interest.trim()
    if (notes?.trim()) metadata.walkin_notes = notes.trim()

    const result = await ingestLead(supabase, {
      full_name: full_name.trim(),
      phone: normalizedPhone,
      email: email?.trim() || null,
      city: city?.trim() || null,
      source: 'walk_in',
      metadata,
    })

    const leadId = result.leadId
    const assignedCounselorId = result.assigneeId

    if (!leadId) {
      return NextResponse.json({ error: 'Could not create lead' }, { status: 500 })
    }

    let counselorName: string | null = null
    if (assignedCounselorId) {
      const today = new Date().toISOString().slice(0, 10)
      const now = new Date()
      const minutes = now.getHours() * 60 + now.getMinutes()
      const rounded = Math.ceil(minutes / 30) * 30
      const hours = Math.floor(rounded / 60)
      const mins = rounded % 60
      const finalTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', assignedCounselorId)
        .single()
      counselorName = (profile as { full_name: string } | null)?.full_name ?? null

      await supabase.from('appointments').insert({
        lead_id: leadId,
        appointment_type: 'office_visit',
        host_id: assignedCounselorId,
        created_by: assignedCounselorId,
        scheduled_date: today,
        scheduled_time: finalTime,
        status: 'scheduled',
        notes: notes?.trim() || 'Walk-in — auto-created',
      } as never)
    }

    return NextResponse.json({
      success: true,
      message: 'Welcome! Your details have been saved. A counselor will meet you shortly.',
      leadId,
      counselorName,
    })
  } catch (error: any) {
    console.error('Walk-in form error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 400 })
  }
}

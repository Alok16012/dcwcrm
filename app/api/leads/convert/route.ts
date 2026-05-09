import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lead_id, total_fee, amount_paid, mode, department_id, sub_section_id } = body

    if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

    // Verify calling user is authenticated
    const userClient = await createServerClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch the lead
    const { data: lead, error: leadErr } = await adminClient
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single()

    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    // Update lead to converted
    const { error: updateErr } = await adminClient
      .from('leads')
      .update({
        status: 'converted',
        total_fee: total_fee ?? null,
        amount_paid: amount_paid ?? 0,
        mode: mode || null,
        department_id: department_id || null,
        sub_section_id: sub_section_id || null,
        converted_at: new Date().toISOString(),
      })
      .eq('id', lead_id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

    // Create or update student with status='pending' (bypasses RLS via service role)
    const { error: studentErr } = await adminClient
      .from('students')
      .upsert({
        lead_id,
        full_name: lead.full_name,
        phone: lead.phone,
        email: lead.email,
        course_id: lead.course_id,
        sub_course_id: lead.sub_course_id,
        assigned_counsellor: lead.assigned_to,
        total_fee: total_fee ?? null,
        amount_paid: amount_paid ?? 0,
        enrollment_date: new Date().toISOString().split('T')[0],
        mode: mode || null,
        department_id: department_id || null,
        sub_section_id: sub_section_id || null,
        status: 'pending',
      }, { onConflict: 'lead_id' })

    if (studentErr) return NextResponse.json({ error: studentErr.message }, { status: 400 })

    // Record initial payment if any
    if (amount_paid && amount_paid > 0) {
      await adminClient.from('payments').insert({
        lead_id,
        amount: amount_paid,
        payment_mode: 'cash',
        payment_date: new Date().toISOString().split('T')[0],
        notes: 'Initial payment during conversion',
        recorded_by: user.id,
      })
    }

    // Log activity
    await adminClient.from('lead_activities').insert({
      lead_id,
      activity_type: 'converted',
      performed_by: user.id,
      new_value: `Fee: ${total_fee}, Paid: ${amount_paid}, Mode: ${mode}`,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

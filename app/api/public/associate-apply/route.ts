import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Public associate registration (shared as /join).
 *
 * GET  — the coordinators an applicant can pick from.
 * POST — files the application as a pending associate, owned by the chosen
 *        coordinator, so it lands in Associates → Approvals like any other.
 */

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function GET() {
  const { data, error } = await admin()
    .from('profiles')
    .select('id, full_name')
    .in('role', ['lead', 'counselor'])
    .eq('is_active', true)
    .order('full_name')

  if (error) return NextResponse.json({ error: 'Could not load coordinators' }, { status: 500 })
  return NextResponse.json({ coordinators: data ?? [] })
}

interface ApplyBody {
  name?: string; phone?: string; email?: string; father_name?: string
  aadhar_number?: string; pan_number?: string
  state?: string; district?: string; city?: string; pincode?: string
  institution_name?: string; institution_address?: string
  account_holder_name?: string; bank_name?: string; account_number?: string; ifsc_code?: string
  coordinator_id?: string
  /** Honeypot — bots fill hidden fields, people don't. */
  hp?: string
}

export async function POST(req: NextRequest) {
  let body: ApplyBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid submission' }, { status: 400 }) }

  if (body.hp) return NextResponse.json({ ok: true })

  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const phoneDigits = (body.phone ?? '').replace(/\D/g, '').slice(-10)

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (phoneDigits.length !== 10) return NextResponse.json({ error: 'Enter a valid 10-digit mobile number' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  if (body.pincode && !/^\d{6}$/.test(body.pincode)) return NextResponse.json({ error: 'Pincode must be 6 digits' }, { status: 400 })
  if (!body.coordinator_id) return NextResponse.json({ error: 'Please select your coordinator' }, { status: 400 })

  const db = admin()

  const { data: coordinator } = await db
    .from('profiles').select('id, full_name')
    .eq('id', body.coordinator_id).in('role', ['lead', 'counselor']).eq('is_active', true)
    .maybeSingle() as { data: { id: string; full_name: string } | null }
  if (!coordinator) return NextResponse.json({ error: 'Please select your coordinator' }, { status: 400 })

  // Same person applying twice shouldn't create a second application.
  // A number can already sit on more than one row, so take the first match
  // rather than asking for exactly one.
  const { data: existingRows } = await db
    .from('associates').select('id, status').or(`phone.eq.${phoneDigits},email.eq.${email}`).limit(1) as
    { data: { id: string; status: string }[] | null }
  const existing = (existingRows ?? [])[0]
  if (existing) {
    return NextResponse.json({
      error: existing.status === 'approved'
        ? 'You are already registered as an associate. Please log in.'
        : 'An application with this mobile or email is already with us — your coordinator will contact you.',
    }, { status: 409 })
  }

  const { error } = await db.from('associates').insert({
    name,
    phone: phoneDigits,
    email,
    father_name: (body.father_name ?? '').trim() || null,
    aadhar_number: (body.aadhar_number ?? '').trim() || null,
    pan_number: (body.pan_number ?? '').trim().toUpperCase() || null,
    state: (body.state ?? '').trim() || null,
    district: (body.district ?? '').trim() || null,
    city: (body.city ?? '').trim() || null,
    pincode: (body.pincode ?? '').trim() || null,
    institution_name: (body.institution_name ?? '').trim() || null,
    institution_address: (body.institution_address ?? '').trim() || null,
    account_holder_name: (body.account_holder_name ?? '').trim() || null,
    bank_name: (body.bank_name ?? '').trim() || null,
    account_number: (body.account_number ?? '').trim() || null,
    ifsc_code: (body.ifsc_code ?? '').trim().toUpperCase() || null,
    coordinator_id: coordinator.id,
    coordinator_name: coordinator.full_name,
    status: 'pending',
  } as never)

  if (error) {
    console.error('associate-apply insert failed:', error)
    return NextResponse.json({ error: 'Could not submit your application. Please try again.' }, { status: 500 })
  }

  // Tell the coordinator an application is waiting (best effort)
  try {
    await db.from('notifications').insert({
      title: 'New associate application',
      message: `${name} (${phoneDigits}) ne associate ke liye apply kiya hai — Associates → Approvals me dekho.`,
      type: 'info',
      target_user_id: coordinator.id,
    } as never)
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true })
}

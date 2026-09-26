import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { BB_MANAGER_ROLES, BB_ROLES } from '@/lib/bb/constants'

/**
 * Berojgar Bharat staff accounts.
 *
 * Creating one touches three places — an auth user, a profiles row, and a
 * bb_employees row — and a BB admin holds none of the privileges needed for
 * the first two (profiles RLS answers only to the DCW 'admin' role). So this
 * runs server-side under the service key, after checking the caller is a BB
 * manager, rather than widening the DCW policy to let BB write profiles.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireBbManager() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = (await supabase
    .from('profiles').select('role').eq('id', user.id).single()) as { data: { role: string } | null }

  if (!profile || !BB_MANAGER_ROLES.includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, role: profile.role }
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** Mixed case, digits and a symbol, so any password policy accepts it. */
function generatePassword(): string {
  return `Bb${randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, '')}#7`
}

export async function POST(req: Request) {
  const auth = await requireBbManager()
  if ('error' in auth) return auth.error

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const fullName = String(body.full_name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const role = String(body.role ?? 'bb_telecaller')

  if (!fullName || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }
  if (!(BB_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const password = String(body.password ?? '').trim() || generatePassword()
  const db = adminClient() as any

  const { data: created, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 })
  }

  const { error: profileErr } = await db.from('profiles').upsert({
    id: created.user.id,
    email,
    full_name: fullName,
    role,
    phone: body.phone || null,
    is_active: true,
  })
  if (profileErr) {
    // An auth user with no profile has no role and would be bounced out of
    // every screen — better to leave nothing behind than a broken account.
    await db.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: profileErr.message }, { status: 400 })
  }

  const { error: empErr } = await db.from('bb_employees').insert({
    profile_id: created.user.id,
    employee_code: String(body.employee_code ?? '').trim() ||
      `BB-${Math.floor(Math.random() * 90000 + 10000)}`,
    designation: body.designation || null,
    department: body.department || null,
    joining_date: body.joining_date || null,
    basic_salary: Number(body.basic_salary ?? 0),
    hra: Number(body.hra ?? 0),
    allowances: Number(body.allowances ?? 0),
    pf_deduction: Number(body.pf_deduction ?? 0),
    tds_deduction: Number(body.tds_deduction ?? 0),
    other_deductions: Number(body.other_deductions ?? 0),
    incentive_per_placement: Number(body.incentive_per_placement ?? 0),
    incentive_percent_of_commission: Number(body.incentive_percent_of_commission ?? 0),
    bank_account: body.bank_account || null,
    bank_ifsc: body.bank_ifsc || null,
    bank_name: body.bank_name || null,
    salary_cycle_start_day: Number(body.salary_cycle_start_day ?? 1),
  })
  if (empErr) {
    await db.from('profiles').delete().eq('id', created.user.id)
    await db.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: empErr.message }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    id: created.user.id,
    // Shown once in the UI so it can be handed over; never stored anywhere.
    password: body.password ? null : password,
  })
}

export async function PATCH(req: Request) {
  const auth = await requireBbManager()
  if ('error' in auth) return auth.error

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const profileId = String(body.profile_id ?? '')
  if (!profileId) return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })

  const db = adminClient() as any

  // Never let a BB manager edit someone outside Berojgar Bharat.
  const { data: target } = await db.from('profiles').select('role').eq('id', profileId).single()
  if (!target || !(BB_ROLES as readonly string[]).includes(target.role)) {
    return NextResponse.json({ error: 'Not a Berojgar Bharat account' }, { status: 403 })
  }

  const profilePatch: Record<string, unknown> = {}
  if (body.full_name !== undefined) profilePatch.full_name = String(body.full_name).trim()
  if (body.phone !== undefined) profilePatch.phone = body.phone || null
  if (body.is_active !== undefined) profilePatch.is_active = !!body.is_active
  if (body.role !== undefined) {
    if (!(BB_ROLES as readonly string[]).includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    profilePatch.role = body.role
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await db.from('profiles').update(profilePatch).eq('id', profileId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const EMPLOYEE_FIELDS = [
    'designation', 'department', 'joining_date', 'basic_salary', 'hra', 'allowances',
    'pf_deduction', 'tds_deduction', 'other_deductions', 'incentive_per_placement',
    'incentive_percent_of_commission', 'bank_account', 'bank_ifsc', 'bank_name',
    'salary_cycle_start_day', 'is_active', 'employee_code',
  ]
  const employeePatch: Record<string, unknown> = {}
  for (const f of EMPLOYEE_FIELDS) {
    if (body[f] !== undefined) employeePatch[f] = body[f]
  }
  // Deactivating the login deactivates the staff record with it.
  if (body.is_active !== undefined) employeePatch.is_active = !!body.is_active

  if (Object.keys(employeePatch).length > 0) {
    const { error } = await db.from('bb_employees').update(employeePatch).eq('profile_id', profileId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

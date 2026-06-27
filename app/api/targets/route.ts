import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

interface RevenueTarget {
  id: string
  assignee_id: string
  title: string
  target_amount: number
  lead_target: number
  conversion_target: number
  period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom'
  start_date: string
  end_date: string
  bonus_percentage: number
  notes: string | null
  status: 'active' | 'archived'
  created_by: string | null
  created_at: string
  updated_at: string
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function currentProfile() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single() as { data: { id: string; role: string } | null }
  return data
}

export async function GET() {
  const profile = await currentProfile()
  if (!profile || !['admin', 'lead', 'counselor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = adminClient()
  let query = supabase
    .from('revenue_targets')
    .select('*, assignee:profiles!revenue_targets_assignee_id_fkey(id, full_name, role)')
    .order('created_at', { ascending: false })
  if (profile.role !== 'admin') query = query.eq('assignee_id', profile.id)
  const { data: targets, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    targets: targets ?? [],
  })
}

export async function POST(request: Request) {
  const profile = await currentProfile()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Only admin can assign targets' }, { status: 403 })
  }

  const body = await request.json()
  const target: Partial<RevenueTarget> = {
    assignee_id: String(body.assignee_id ?? ''),
    title: String(body.title ?? 'Revenue Target'),
    target_amount: Number(body.target_amount ?? 0),
    lead_target: Number(body.lead_target ?? 0),
    conversion_target: Number(body.conversion_target ?? 0),
    period_type: body.period_type ?? 'monthly',
    start_date: String(body.start_date ?? ''),
    end_date: String(body.end_date ?? ''),
    bonus_percentage: Number(body.bonus_percentage ?? 0),
    notes: body.notes ? String(body.notes) : null,
    created_by: profile.id,
  }

  if (!target.assignee_id || !target.start_date || !target.end_date) {
    return NextResponse.json({ error: 'Missing target details' }, { status: 400 })
  }
  if (target.end_date < target.start_date) {
    return NextResponse.json({ error: 'Invalid target date range' }, { status: 400 })
  }

  const { data, error } = await adminClient()
    .from('revenue_targets')
    .insert(target)
    .select('*, assignee:profiles!revenue_targets_assignee_id_fkey(id, full_name, role)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ target: data })
}

export async function PATCH(request: Request) {
  const profile = await currentProfile()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Only admin can update targets' }, { status: 403 })
  }

  const body = await request.json()
  const id = String(body.id ?? '')
  const { data, error } = await adminClient()
    .from('revenue_targets')
    .update({ status: body.status === 'archived' ? 'archived' : 'active' })
    .eq('id', id)
    .select('*, assignee:profiles!revenue_targets_assignee_id_fkey(id, full_name, role)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ target: data })
}

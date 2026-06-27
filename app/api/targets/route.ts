import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { loadRevenueTargets, saveRevenueTargets, type StoredRevenueTarget } from '@/lib/revenue-target-store'

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
  const targets = await loadRevenueTargets()
  return NextResponse.json({
    targets: profile.role === 'admin' ? targets : targets.filter(t => t.assignee_id === profile.id),
  })
}

export async function POST(request: Request) {
  const profile = await currentProfile()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Only admin can assign targets' }, { status: 403 })
  }

  const body = await request.json()
  const now = new Date().toISOString()
  const target: StoredRevenueTarget = {
    id: crypto.randomUUID(),
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
    status: 'active',
    created_by: profile.id,
    created_at: now,
    updated_at: now,
  }

  if (!target.assignee_id || !target.start_date || !target.end_date) {
    return NextResponse.json({ error: 'Missing target details' }, { status: 400 })
  }
  if (target.end_date < target.start_date) {
    return NextResponse.json({ error: 'Invalid target date range' }, { status: 400 })
  }

  const targets = await loadRevenueTargets()
  targets.unshift(target)
  await saveRevenueTargets(targets)
  return NextResponse.json({ target })
}

export async function PATCH(request: Request) {
  const profile = await currentProfile()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Only admin can update targets' }, { status: 403 })
  }

  const body = await request.json()
  const id = String(body.id ?? '')
  const targets = await loadRevenueTargets()
  const idx = targets.findIndex(t => t.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Target not found' }, { status: 404 })

  targets[idx] = {
    ...targets[idx],
    status: body.status === 'archived' ? 'archived' : targets[idx].status,
    updated_at: new Date().toISOString(),
  }
  await saveRevenueTargets(targets)
  return NextResponse.json({ target: targets[idx] })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { request_id, action, rejection_reason } = await request.json()
    if (!request_id || !action) return NextResponse.json({ error: 'request_id and action required' }, { status: 400 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    ) as any

    // Fetch the request
    const { data: req, error: fetchErr } = await admin
      .from('wallet_recharge_requests')
      .select('*, associate:associates(id, wallet_balance)')
      .eq('id', request_id)
      .single()

    if (fetchErr || !req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (req.status !== 'pending') return NextResponse.json({ error: 'Already processed' }, { status: 400 })

    if (action === 'reject') {
      await admin
        .from('wallet_recharge_requests')
        .update({ status: 'rejected', rejection_reason: rejection_reason ?? 'Rejected by OPS' })
        .eq('id', request_id)
      return NextResponse.json({ ok: true })
    }

    // APPROVE: update balance + log txn + mark approved
    const newBalance = Number(req.associate.wallet_balance) + Number(req.amount)

    const [r1, r2, r3] = await Promise.all([
      admin.from('associates').update({ wallet_balance: newBalance }).eq('id', req.associate_id),
      admin.from('associate_wallet_txns').insert({
        associate_id: req.associate_id,
        type: 'credit',
        amount: req.amount,
        reason: `Wallet recharge approved — ₹${Number(req.amount).toLocaleString('en-IN')}`,
      }),
      admin.from('wallet_recharge_requests').update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      }).eq('id', request_id),
    ])

    if (r1.error || r2.error || r3.error) {
      return NextResponse.json({ error: r1.error?.message ?? r2.error?.message ?? r3.error?.message }, { status: 400 })
    }

    // Notification to associate
    await admin.from('associate_notifications').insert({
      associate_id: req.associate_id,
      title: 'Wallet Recharged!',
      message: `₹${Number(req.amount).toLocaleString('en-IN')} has been added to your wallet. New balance: ₹${newBalance.toLocaleString('en-IN')}`,
    })

    return NextResponse.json({ ok: true, new_balance: newBalance })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

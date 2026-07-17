import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Delete a payroll row (drafts/processed only — paid slips are locked).
// Any salary advances that were being recovered in it go back to pending.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const supabase = await createServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null }
        if (!['admin', 'backend'].includes(profile?.role ?? '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { data: row } = await supabase
            .from('payroll')
            .select('id, status')
            .eq('id', id)
            .maybeSingle() as { data: { id: string; status: string } | null }

        if (!row) return NextResponse.json({ error: 'Payroll not found' }, { status: 404 })
        if (row.status === 'paid') {
            return NextResponse.json({ error: 'Paid payroll cannot be deleted' }, { status: 400 })
        }

        // Release advances that were tied to this payroll
        await supabase
            .from('advance_salaries')
            .update({ status: 'pending', settled_in: null } as never)
            .eq('settled_in', id)

        const { error } = await supabase.from('payroll').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })

        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

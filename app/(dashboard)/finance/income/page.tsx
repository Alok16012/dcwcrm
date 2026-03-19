import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import IncomeTable from '@/components/finance/IncomeTable'

export default async function IncomeePage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (!profile || !['admin', 'finance'].includes(profile.role)) redirect('/')

  const { data: paymentsRaw, error } = await supabase
    .from('payments')
    .select('id, payment_date, amount, payment_mode, receipt_number, notes, student_id, recorded_by')
    .order('payment_date', { ascending: false })

  if (error) {
    return <div className="p-4 text-red-500">Failed to load payments: {error.message}</div>
  }

  const payments = paymentsRaw as {
    id: string; payment_date: string; amount: number; payment_mode: string;
    receipt_number: string | null; notes: string | null; student_id: string | null; recorded_by: string | null;
  }[] | null

  const rows = (payments ?? []).map((p) => ({
    id: p.id,
    payment_date: p.payment_date,
    student_name: p.student_id ? 'Student Payment' : 'Manual Income', // Simplified indicator
    course_name: '—',
    amount: p.amount,
    payment_mode: p.payment_mode,
    receipt_number: p.receipt_number,
    notes: p.notes,
    recorded_by_name: '—',
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Income</h1>
        <p className="text-sm text-muted-foreground">All payments received from students</p>
      </div>
      <IncomeTable data={rows} />
    </div>
  )
}

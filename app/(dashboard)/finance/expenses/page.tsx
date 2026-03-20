import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import ExpenseTable from '@/components/finance/ExpenseTable'

export default async function ExpensesPage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/')

  const { data: expensesRaw, error } = await supabase
    .from('expenses')
    .select('id, expense_date, category, description, amount, payment_mode, bill_url, status, submitted_by')
    .order('expense_date', { ascending: false })
  const expenses = expensesRaw as {
    id: string; expense_date: string; category: string; description: string;
    amount: number; payment_mode: string | null; bill_url: string | null;
    status: string; submitted_by: string | null;
  }[] | null

  if (error) {
    return <div className="p-4 text-red-500">Failed to load expenses: {error.message}</div>
  }

  const rows = (expenses ?? []).map((e) => ({
    id: e.id,
    expense_date: e.expense_date,
    category: e.category as import('@/types/app.types').ExpenseCategory,
    description: e.description,
    amount: e.amount,
    payment_mode: e.payment_mode,
    bill_url: e.bill_url,
    submitted_by_name: '—',
    status: e.status as 'pending' | 'approved' | 'rejected',
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Expenses</h1>
        <p className="text-sm text-muted-foreground">Track and approve business expenses</p>
      </div>
      <ExpenseTable data={rows} currentUserId={user.id} currentUserRole={profile.role} />
    </div>
  )
}

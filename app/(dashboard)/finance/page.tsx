import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import FinanceSummary from '@/components/finance/FinanceSummary'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import Link from 'next/link'

export default async function FinancePage() {
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

  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const [incomeRes, expenseRes, studentRes, pendingRes] = await Promise.all([
    supabase.from('payments').select('amount').gte('payment_date', monthStart).lte('payment_date', monthEnd),
    supabase.from('expenses').select('amount').eq('status', 'approved').gte('expense_date', monthStart).lte('expense_date', monthEnd),
    supabase.from('students').select('total_fee, amount_paid'),
    supabase.from('expenses').select('id').eq('status', 'pending'),
  ])

  const incomeData = incomeRes.data as { amount: number }[] | null
  const expenseData = expenseRes.data as { amount: number }[] | null
  const studentData = studentRes.data as { total_fee: number | null; amount_paid: number }[] | null
  const pendingData = pendingRes.data as { id: string }[] | null

  const totalIncomeThisMonth = (incomeData ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  const totalExpensesThisMonth = (expenseData ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  const outstandingReceivables = (studentData ?? []).reduce(
    (s, r) => s + Math.max(0, (r.total_fee ?? 0) - (r.amount_paid ?? 0)),
    0
  )
  const pendingExpenseCount = (pendingData ?? []).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Finance Dashboard</h1>
        <p className="text-sm text-muted-foreground">{format(now, 'MMMM yyyy')}</p>
      </div>
      <FinanceSummary
        totalIncomeThisMonth={totalIncomeThisMonth}
        totalExpensesThisMonth={totalExpensesThisMonth}
        outstandingReceivables={outstandingReceivables}
        pendingExpenseCount={pendingExpenseCount}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/finance/income" className="group rounded-lg border p-4 hover:bg-muted/50 transition-colors flex justify-between items-center">
          <div>
            <h3 className="font-semibold group-hover:text-blue-600 transition-colors">Income Ledger &rarr;</h3>
            <p className="text-sm text-muted-foreground">View all payments received and add Manual Income</p>
          </div>
        </Link>
        <Link href="/finance/expenses" className="group rounded-lg border p-4 hover:bg-muted/50 transition-colors flex justify-between items-center">
          <div>
            <h3 className="font-semibold group-hover:text-blue-600 transition-colors">Expenses Ledger &rarr;</h3>
            <p className="text-sm text-muted-foreground">Manage and approve expenses</p>
          </div>
        </Link>
      </div>
    </div>
  )
}

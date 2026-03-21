import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export default async function IncentivePage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single() as { data: { role: string } | null }

  if (rawProfile?.role !== 'lead' && rawProfile?.role !== 'admin') redirect('/')

  // Find employee record for current user
  const { data: empRow } = await supabase
    .from('employees')
    .select('id')
    .eq('profile_id', session.user.id)
    .single()

  type PayrollRow = { month: number; year: number; incentive: number; net: number; status: string; payment_date: string | null }
  let payrollRows: PayrollRow[] = []

  if (empRow) {
    const { data } = await supabase
      .from('payroll')
      .select('month, year, incentive, net, status, payment_date')
      .eq('employee_id', (empRow as { id: string }).id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    payrollRows = (data ?? []) as PayrollRow[]
  }

  const totalIncentive = payrollRows.reduce((s, r) => s + (r.incentive ?? 0), 0)
  const paidIncentive = payrollRows.filter((r) => r.status === 'paid').reduce((s, r) => s + (r.incentive ?? 0), 0)
  const unpaidIncentive = totalIncentive - paidIncentive

  return (
    <div className="space-y-6">
      <PageHeader title="My Incentives" description="Month-wise incentive status from payroll" />

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 bg-purple-50">
          <p className="text-sm text-purple-700 font-medium">Total Incentive</p>
          <p className="text-2xl font-bold text-purple-900">{fmt(totalIncentive)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-green-50">
          <p className="text-sm text-green-700 font-medium">Paid</p>
          <p className="text-2xl font-bold text-green-900">{fmt(paidIncentive)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-amber-50">
          <p className="text-sm text-amber-700 font-medium">Pending / Not Paid</p>
          <p className="text-2xl font-bold text-amber-900">{fmt(unpaidIncentive)}</p>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-sm">Month-wise Incentive Breakdown</h3>
        </div>
        {payrollRows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            {empRow ? 'No payroll records found.' : 'No employee record linked to your account. Contact admin.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Month</th>
                <th className="text-right px-4 py-2 text-gray-600 font-medium">Incentive</th>
                <th className="text-right px-4 py-2 text-gray-600 font-medium">Net Pay</th>
                <th className="text-right px-4 py-2 text-gray-600 font-medium">Payment Date</th>
                <th className="text-right px-4 py-2 text-gray-600 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payrollRows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{MONTH_NAMES[row.month - 1]} {row.year}</td>
                  <td className="px-4 py-3 text-right text-purple-700 font-semibold">{fmt(row.incentive ?? 0)}</td>
                  <td className="px-4 py-3 text-right">{fmt(row.net ?? 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {row.payment_date ? new Date(row.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge
                      variant={row.status === 'paid' ? 'default' : row.status === 'processed' ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {row.status === 'paid' ? 'Paid' : row.status === 'processed' ? 'Processed' : 'Pending'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

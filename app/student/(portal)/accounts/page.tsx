import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Wallet, CheckCircle2, Clock, AlertCircle, Download, Receipt } from 'lucide-react'

export default async function AccountsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/student/login')

  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, enrollment_number, total_fee, amount_paid')
    .eq('portal_user_id', user.id)
    .single()

  if (!student) redirect('/student/login')

  const s = student as { id: string; full_name: string; enrollment_number: string; total_fee: number | null; amount_paid: number }
  const pending = (s.total_fee ?? 0) - s.amount_paid

  const { data: payments } = await (supabase as any)
    .from('payments')
    .select('id, amount, payment_mode, payment_date, receipt_number, notes')
    .eq('student_id', s.id)
    .order('payment_date', { ascending: false }) as { data: Array<{ id: string; amount: number; payment_mode: string; payment_date: string; receipt_number: string | null; notes: string | null }> | null }

  const modeLabel: Record<string, string> = {
    cash: 'Cash', upi: 'UPI', card: 'Card', neft: 'NEFT',
    rtgs: 'RTGS', cheque: 'Cheque', other: 'Other',
  }

  const paymentPct = s.total_fee ? Math.min(100, Math.round((s.amount_paid / s.total_fee) * 100)) : 0

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Accounts & Payments</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your fee summary and payment history</p>
      </div>

      {/* Fee summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Fee', value: s.total_fee ? `₹${s.total_fee.toLocaleString('en-IN')}` : '—', icon: Wallet, bg: 'bg-blue-50', color: 'text-blue-700', border: 'border-blue-100' },
          { label: 'Paid', value: `₹${s.amount_paid.toLocaleString('en-IN')}`, icon: CheckCircle2, bg: 'bg-green-50', color: 'text-green-700', border: 'border-green-100' },
          { label: 'Pending', value: pending > 0 ? `₹${pending.toLocaleString('en-IN')}` : 'Clear', icon: pending > 0 ? AlertCircle : CheckCircle2, bg: pending > 0 ? 'bg-red-50' : 'bg-green-50', color: pending > 0 ? 'text-red-700' : 'text-green-700', border: pending > 0 ? 'border-red-100' : 'border-green-100' },
        ].map(({ label, value, icon: Icon, bg, color, border }) => (
          <div key={label} className={`${bg} border ${border} rounded-2xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-4 w-4 ${color}`} />
              <p className={`text-xs font-medium ${color}`}>{label}</p>
            </div>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {s.total_fee && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium text-gray-700">Fee Payment Progress</p>
            <p className="text-sm font-bold text-blue-700">{paymentPct}%</p>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full" style={{ width: `${paymentPct}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-gray-400">₹0</span>
            <span className="text-xs text-gray-400">₹{s.total_fee.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* Pending dues notice */}
      {pending > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Pending Dues: ₹{pending.toLocaleString('en-IN')}</p>
            <p className="text-xs text-red-600 mt-0.5">Please clear your pending dues to avoid any disruption. Contact your counsellor or pay online.</p>
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Payment History</h2>
          {payments && <span className="ml-auto text-xs text-gray-400">{payments.length} transactions</span>}
        </div>
        {!payments?.length ? (
          <div className="py-12 text-center text-gray-400 text-sm">No payments recorded yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {payments.map(p => (
              <div key={p.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">₹{p.amount.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-gray-400">
                      {modeLabel[p.payment_mode] ?? p.payment_mode}
                      {p.receipt_number && ` · ${p.receipt_number}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-700">
                    {new Date(p.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {p.notes && <p className="text-xs text-gray-400 max-w-32 truncate">{p.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment note */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-800 mb-1">💡 How to Pay</p>
        <p className="text-xs text-blue-700">
          To make a payment, contact your counsellor or visit our office. Online payment link will be available soon. All receipts are issued by Distance Courses Wala.
        </p>
      </div>
    </div>
  )
}

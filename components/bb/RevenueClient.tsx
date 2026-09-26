'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { IndianRupee, X, AlertTriangle } from 'lucide-react'
import { bbClient } from '@/lib/bb/db'
import { inr, inrShort, INVOICE_STATUS_STYLE } from '@/lib/bb/constants'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Invoice {
  id: string
  instalment_no: number
  period_start: string | null
  period_end: string | null
  amount: number
  due_date: string
  status: string
  invoice_no: string | null
  amount_received: number
  received_on: string | null
  company_name: string
  candidate_name: string
  job_title: string
  total_instalments: number
}

export default function RevenueClient({
  invoices, today,
}: { invoices: Invoice[]; today: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [filter, setFilter] = useState<'all' | 'due' | 'overdue' | 'paid'>('all')
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [amount, setAmount] = useState('')
  const [receivedOn, setReceivedOn] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [saving, setSaving] = useState(false)

  const isOpen = (i: Invoice) => i.status !== 'paid' && i.status !== 'written_off'
  const outstanding = (i: Invoice) => Number(i.amount) - Number(i.amount_received)

  const shown = invoices.filter(i => {
    if (filter === 'paid') return i.status === 'paid'
    if (filter === 'overdue') return isOpen(i) && i.due_date < today
    if (filter === 'due') return isOpen(i)
    return true
  })

  const booked = invoices.reduce((s, i) => s + Number(i.amount), 0)
  const received = invoices.reduce((s, i) => s + Number(i.amount_received), 0)
  const overdueAmt = invoices.filter(i => isOpen(i) && i.due_date < today).reduce((s, i) => s + outstanding(i), 0)

  function openPayment(i: Invoice) {
    setPaying(i)
    setAmount(String(outstanding(i)))
    setReceivedOn(new Date().toISOString().slice(0, 10))
    setInvoiceNo(i.invoice_no ?? '')
  }

  async function recordPayment() {
    if (!paying) return
    const paid = Number(amount)
    if (!paid || paid <= 0) { toast.error('Enter the amount received'); return }

    setSaving(true)
    try {
      const totalReceived = Number(paying.amount_received) + paid
      // Rounding on percentage splits can leave a rupee behind; treat anything
      // within ₹1 as settled rather than leaving invoices permanently "part paid".
      const status = totalReceived >= Number(paying.amount) - 1 ? 'paid' : 'partially_paid'

      const db = bbClient()
      const { error } = await db
        .from('bb_commission_invoices')
        .update({
          amount_received: totalReceived,
          received_on: receivedOn || null,
          invoice_no: invoiceNo || null,
          status,
        })
        .eq('id', paying.id)
      if (error) throw new Error(error.message)

      toast.success(status === 'paid' ? 'Invoice settled' : 'Part payment recorded')
      setPaying(null)
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Booked', value: booked, tone: 'text-gray-900' },
          { label: 'Received', value: received, tone: 'text-green-700' },
          { label: 'Overdue', value: overdueAmt, tone: overdueAmt > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map(m => (
          <div key={m.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{m.label}</p>
            <p className={`text-3xl font-bold mt-1.5 tabular-nums ${m.tone}`}>{inrShort(m.value)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl w-fit">
        {([
          ['all', 'All'],
          ['due', 'Outstanding'],
          ['overdue', 'Overdue'],
          ['paid', 'Paid'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              filter === key ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <IndianRupee className="w-7 h-7 mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-700">
            {invoices.length === 0 ? 'No invoices yet' : 'Nothing here'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {invoices.length === 0
              ? 'Invoices are created automatically when a candidate joins.'
              : 'Try another filter.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Company</th>
                  <th className="px-4 py-2.5 font-semibold">For</th>
                  <th className="px-4 py-2.5 font-semibold">Due</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Received</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map(i => {
                  const overdue = isOpen(i) && i.due_date < today
                  const st = INVOICE_STATUS_STYLE[i.status] ?? INVOICE_STATUS_STYLE.pending
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{i.company_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <p>{i.candidate_name}</p>
                        <p className="text-gray-400">
                          {i.job_title}
                          {i.total_instalments > 1 && ` · instalment ${i.instalment_no}/${i.total_instalments}`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs tabular-nums inline-flex items-center gap-1 ${overdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                          {overdue && <AlertTriangle className="w-3.5 h-3.5" />}
                          {format(parseISO(i.due_date), 'dd MMM yyyy')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">{inr(i.amount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                        {Number(i.amount_received) > 0 ? inr(i.amount_received) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isOpen(i) && (
                          <button
                            onClick={() => openPayment(i)}
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                          >
                            Record payment
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {paying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPaying(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Record payment</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {paying.company_name} · {inr(paying.amount)} due
                </p>
              </div>
              <button onClick={() => setPaying(null)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-5">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-gray-600">
                  Amount received (outstanding {inr(outstanding(paying))})
                </span>
                <input type="number" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-gray-600">Received on</span>
                  <input type="date" className={inputCls} value={receivedOn} onChange={e => setReceivedOn(e.target.value)} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-gray-600">Invoice no.</span>
                  <input className={inputCls} value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setPaying(null)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={recordPayment} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none'

'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wallet, CheckCircle2, AlertCircle, Download, Receipt, Share2, Copy, Check, Building2, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`

const modeLabel: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card', neft: 'NEFT',
  rtgs: 'RTGS', cheque: 'Cheque', other: 'Other',
}

export default function AccountsPage() {
  const supabase = createClient() as any
  const [student, setStudent] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/student/login'; return }

      const { data: s } = await supabase
        .from('students')
        .select('id, full_name, enrollment_number, total_fee, amount_paid')
        .eq('portal_user_id', user.id)
        .single()

      if (!s) { window.location.href = '/student/login'; return }
      setStudent(s)

      const { data: p } = await supabase
        .from('payments')
        .select('id, amount, payment_mode, payment_date, receipt_number, notes, receipt_url')
        .eq('student_id', s.id)
        .order('payment_date', { ascending: false })
      setPayments(p ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  function buildShareText() {
    if (!student) return ''
    const pending = (student.total_fee ?? 0) - student.amount_paid
    const lines = [
      `📋 Payment Summary — Distance Courses Wala`,
      `Student: ${student.full_name}`,
      `Enrollment No.: ${student.enrollment_number}`,
      ``,
      `💰 Total Fee:  ${fmt(student.total_fee ?? 0)}`,
      `✅ Paid:       ${fmt(student.amount_paid)}`,
      `⏳ Pending:    ${pending > 0 ? fmt(pending) : 'Clear'}`,
      ``,
    ]
    if (payments.length > 0) {
      lines.push(`📝 Payment History:`)
      payments.forEach((p, i) => {
        lines.push(`  ${i + 1}. ${fmt(p.amount)} — ${modeLabel[p.payment_mode] ?? p.payment_mode} — ${new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}${p.receipt_number ? ` (${p.receipt_number})` : ''}`)
      })
      lines.push(``)
    }
    lines.push(`🏦 Pay To:`)
    lines.push(`  Name:    EDUSPHERE EDUCATIONAL & WELFARE TRUST`)
    lines.push(`  UPI ID:  88099511@idfcbank`)
    lines.push(`  A/C No:  10170545354`)
    lines.push(`  IFSC:    IDFB0060282`)
    lines.push(`  Bank:    IDFC FIRST Bank — Patna Kankarbagh Branch`)
    return lines.join('\n')
  }

  async function handleShare() {
    const text = buildShareText()
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Payment Summary — DCW', text })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Payment details copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )
  if (!student) return null

  const pending = (student.total_fee ?? 0) - student.amount_paid
  const paymentPct = student.total_fee ? Math.min(100, Math.round((student.amount_paid / student.total_fee) * 100)) : 0

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Accounts & Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your fee summary and payment history</p>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Share'}
        </button>
      </div>

      {/* Fee summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Fee', value: student.total_fee ? fmt(student.total_fee) : '—', icon: Wallet, bg: 'bg-blue-50', color: 'text-blue-700', border: 'border-blue-100' },
          { label: 'Paid', value: fmt(student.amount_paid), icon: CheckCircle2, bg: 'bg-green-50', color: 'text-green-700', border: 'border-green-100' },
          { label: 'Pending', value: pending > 0 ? fmt(pending) : 'Clear', icon: pending > 0 ? AlertCircle : CheckCircle2, bg: pending > 0 ? 'bg-red-50' : 'bg-green-50', color: pending > 0 ? 'text-red-700' : 'text-green-700', border: pending > 0 ? 'border-red-100' : 'border-green-100' },
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
      {student.total_fee && (
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
            <span className="text-xs text-gray-400">₹{student.total_fee.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* Pending dues notice */}
      {pending > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Pending Dues: {fmt(pending)}</p>
            <p className="text-xs text-red-600 mt-0.5">Please clear your pending dues to avoid any disruption. Contact your counsellor or pay online.</p>
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Payment History</h2>
          {payments.length > 0 && <span className="ml-auto text-xs text-gray-400">{payments.length} transactions</span>}
        </div>
        {!payments.length ? (
          <div className="py-12 text-center text-gray-400 text-sm">No payments recorded yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {payments.map((p, idx) => (
              <div key={p.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0 text-green-500 font-bold text-xs">
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{fmt(p.amount)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {modeLabel[p.payment_mode] ?? p.payment_mode}
                    {p.receipt_number && <span className="font-mono"> · {p.receipt_number}</span>}
                    {p.notes && <span> · {p.notes}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-xs font-medium text-gray-500">
                    {new Date(p.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {p.receipt_url && (
                    <a href={p.receipt_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                      <Download className="h-3 w-3" /> Receipt
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
          <Share2 className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900">Share Payment Summary</p>
          <p className="text-xs text-blue-600 mt-0.5">Tap Share to send your payment details via WhatsApp, email, or copy to clipboard.</p>
        </div>
        <button onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shrink-0">
          {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
        </button>
      </div>

      {/* Payment Details Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Payment Details</h2>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
          >
            {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Share2 className="h-3.5 w-3.5" /> Share</>}
          </button>
        </div>

        {/* UPI */}
        <div className="px-5 py-4 border-b border-gray-50 bg-gradient-to-r from-orange-50 to-yellow-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl border border-orange-200 flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-0.5">UPI Payment</p>
              <p className="text-base font-bold text-gray-900 font-mono">88099511@idfcbank</p>
              <p className="text-xs text-gray-500 mt-0.5">Scan & pay via PhonePe, GPay, Paytm, BHIM</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText('88099511@idfcbank'); toast.success('UPI ID copied!') }}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-white border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors shrink-0"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
        </div>

        {/* Bank Details */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Bank Transfer / NEFT / RTGS</p>
          <div className="space-y-2.5">
            {[
              { label: 'Account Name',   value: 'EDUSPHERE EDUCATIONAL & WELFARE TRUST', mono: false },
              { label: 'Account Number', value: '10170545354', mono: true },
              { label: 'IFSC Code',      value: 'IDFB0060282', mono: true },
              { label: 'SWIFT Code',     value: 'IDFBINBBMUM', mono: true },
              { label: 'Bank',           value: 'IDFC FIRST Bank', mono: false },
              { label: 'Branch',         value: 'Patna — Kankarbagh Branch', mono: false },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex items-center gap-3">
                <p className="text-xs text-gray-400 w-32 shrink-0">{label}</p>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <p className={`text-sm font-semibold text-gray-800 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
                  {mono && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied!`) }}
                      className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
          <p className="text-xs text-blue-700">After payment, share your receipt with your counsellor for confirmation.</p>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Wallet, PlusCircle, Upload, Clock, CheckCircle2, XCircle, X, FileImage, GraduationCap, Share2, Copy, Check, Building2, Smartphone, AlertCircle } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

interface Txn {
  id: string
  type: 'credit' | 'debit'
  amount: number
  reason: string | null
  created_at: string
}

interface StudentFee {
  id: string; full_name: string; enrollment_number: string
  total_fee: number | null; amount_paid: number
  course: { name: string } | null
}

interface RechargeRequest {
  id: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  receipt_url: string | null
  rejection_reason: string | null
  created_at: string
}

export default function AssociateAccountPage() {
  const supabase = createClient()
  const db = supabase as any
  const fileRef = useRef<HTMLInputElement>(null)

  const [assocId, setAssocId] = useState<string | null>(null)
  const [assocName, setAssocName] = useState('')
  const [balance, setBalance] = useState(0)
  const [code, setCode] = useState('')
  const [txns, setTxns] = useState<Txn[]>([])
  const [requests, setRequests] = useState<RechargeRequest[]>([])
  const [students, setStudents] = useState<StudentFee[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const [rechargeOpen, setRechargeOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: assoc } = await db.from('associates').select('id, name, wallet_balance, associate_code').eq('user_id', user.id).single()
    if (!assoc) { setLoading(false); return }
    setAssocId(assoc.id)
    setAssocName(assoc.name ?? '')
    setBalance(assoc.wallet_balance ?? 0)
    setCode(assoc.associate_code ?? '')

    // Get leads for this associate to find students via lead_id
    const { data: assocLeads } = await supabase.from('leads').select('id').eq('referred_by_associate', assoc.id)
    const leadIds = ((assocLeads ?? []) as any[]).map((l: any) => l.id)

    const [txnRes, reqRes, stuRes1, stuRes2] = await Promise.all([
      db.from('associate_wallet_txns').select('*').eq('associate_id', assoc.id).order('created_at', { ascending: false }),
      db.from('wallet_recharge_requests').select('*').eq('associate_id', assoc.id).order('created_at', { ascending: false }),
      db.from('students').select('id, full_name, enrollment_number, total_fee, amount_paid, course:courses(name)')
        .eq('referred_by_associate', assoc.id).order('full_name'),
      leadIds.length > 0
        ? db.from('students').select('id, full_name, enrollment_number, total_fee, amount_paid, course:courses(name)')
            .in('lead_id', leadIds).order('full_name')
        : Promise.resolve({ data: [] }),
    ])
    setTxns((txnRes.data ?? []) as Txn[])
    setRequests((reqRes.data ?? []) as RechargeRequest[])

    // Merge students, deduplicate
    const allStu = [...(stuRes1.data ?? []), ...(stuRes2.data ?? [])]
    const seen = new Set<string>()
    setStudents(allStu.filter((s: any) => { if (seen.has(s.id)) return false; seen.add(s.id); return true }) as StudentFee[])
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  async function handleRechargeSubmit() {
    if (!amount || Number(amount) <= 0) { toast.error('Enter a valid amount'); return }
    if (!file) { toast.error('Please upload a payment receipt'); return }
    if (!assocId) return
    setSubmitting(true)
    try {
      // Upload receipt to Supabase storage
      const ext = file.name.split('.').pop()
      const path = `receipts/${assocId}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('associate-receipts').upload(path, file, { upsert: true })

      let receipt_url: string | null = null
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('associate-receipts').getPublicUrl(path)
        receipt_url = urlData.publicUrl
      }

      const { error } = await db.from('wallet_recharge_requests').insert({
        associate_id: assocId,
        amount: Number(amount),
        receipt_url,
        status: 'pending',
      })

      if (error) { toast.error(error.message); return }
      toast.success('Recharge request submitted — pending OPS approval')
      setRechargeOpen(false)
      setAmount('')
      setFile(null)
      load()
    } finally {
      setSubmitting(false)
    }
  }

  const credited = txns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  const debited = txns.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0)
  const pendingRequests = requests.filter(r => r.status === 'pending')

  const totalFee = students.reduce((s, st) => s + (st.total_fee ?? 0), 0)
  const totalPaid = students.reduce((s, st) => s + st.amount_paid, 0)
  const totalPending = totalFee - totalPaid

  function buildShareText() {
    const lines = [
      `📊 Fee Summary — ${assocName} (${code})`,
      ``,
      `Students: ${students.length}`,
      `Total Fee:  ${fmt(totalFee)}`,
      `Paid:       ${fmt(totalPaid)}`,
      `Pending:    ${fmt(totalPending)}`,
      ``,
      `Student-wise:`,
    ]
    students.forEach((s, i) => {
      const pending = (s.total_fee ?? 0) - s.amount_paid
      lines.push(`  ${i+1}. ${s.full_name} (${s.enrollment_number ?? '—'})`)
      lines.push(`     Fee: ${fmt(s.total_fee ?? 0)} | Paid: ${fmt(s.amount_paid)} | Pending: ${fmt(pending)}`)
    })
    lines.push(``)
    lines.push(`💳 Pay To:`)
    lines.push(`  UPI: 88099511@idfcbank`)
    lines.push(`  A/C: 10170545354 | IFSC: IDFB0060282`)
    lines.push(`  EDUSPHERE EDUCATIONAL & WELFARE TRUST`)
    return lines.join('\n')
  }

  async function handleShare() {
    const text = buildShareText()
    if (navigator.share) {
      try { await navigator.share({ title: 'Fee Summary', text }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Wallet balance & transaction history</p>
        </div>
        <Button onClick={() => setRechargeOpen(true)} className="gap-2">
          <PlusCircle className="w-4 h-4" /> Recharge Wallet
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-blue-600 rounded-xl p-5 text-white">
              <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">Wallet Balance</p>
              <p className="text-3xl font-bold mt-1">{fmt(balance)}</p>
              <p className="text-blue-200 text-xs mt-2">Code: {code}</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{fmt(credited)}</p>
              <p className="text-xs text-green-600 mt-1">Total Credited</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{fmt(debited)}</p>
              <p className="text-xs text-red-600 mt-1">Total Debited</p>
            </div>
          </div>

          {/* Student Fee Summary */}
          {students.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-indigo-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">Student Fee Summary</h3>
                  <span className="text-xs text-gray-400">{students.length} students</span>
                </div>
                <button onClick={handleShare}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                  {copied ? <><Check className="h-3.5 w-3.5" />Copied!</> : <><Share2 className="h-3.5 w-3.5" />Share</>}
                </button>
              </div>

              {/* Totals row */}
              <div className="grid grid-cols-3 divide-x divide-gray-50 border-b border-gray-50">
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Total Fee</p>
                  <p className="text-base font-extrabold text-gray-800 mt-0.5">{fmt(totalFee)}</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-wide">Paid</p>
                  <p className="text-base font-extrabold text-green-700 mt-0.5">{fmt(totalPaid)}</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: totalPending > 0 ? '#ef4444' : '#10b981' }}>Pending</p>
                  <p className={`text-base font-extrabold mt-0.5 ${totalPending > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {totalPending > 0 ? fmt(totalPending) : 'Clear'}
                  </p>
                </div>
              </div>

              {/* Student-wise rows */}
              <div className="divide-y divide-gray-50">
                {students.map((s, i) => {
                  const pending = (s.total_fee ?? 0) - s.amount_paid
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0 text-indigo-600 font-bold text-xs">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{s.full_name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {s.enrollment_number && <span className="text-xs font-mono text-gray-400">{s.enrollment_number}</span>}
                          {s.course && <span className="text-xs text-gray-400">· {(s.course as {name:string}).name}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        {s.total_fee ? (
                          <>
                            <p className="text-xs font-bold text-gray-700">{fmt(s.total_fee)}</p>
                            <p className={`text-xs font-semibold ${pending > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {pending > 0 ? `${fmt(pending)} due` : 'Clear'}
                            </p>
                          </>
                        ) : <p className="text-xs text-gray-400">—</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* DCW Payment Details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900 text-sm">Payment Details</h3>
              </div>
              <button onClick={handleShare}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                {copied ? <><Check className="h-3.5 w-3.5" />Copied!</> : <><Share2 className="h-3.5 w-3.5" />Share</>}
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
                  <p className="text-xs text-gray-500 mt-0.5">PhonePe · GPay · Paytm · BHIM</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText('88099511@idfcbank'); toast.success('UPI ID copied!') }}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-white border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 shrink-0">
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            </div>
            {/* Bank */}
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
                        <button onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied!`) }}
                          className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
              <p className="text-xs text-blue-700">After payment, share receipt with your counsellor for confirmation.</p>
            </div>
          </div>

          {/* Pending Recharge Requests */}
          {pendingRequests.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Pending Recharge Requests</p>
              <div className="space-y-2">
                {pendingRequests.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{fmt(r.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 border-0 gap-1">
                      <Clock className="w-3 h-3" /> Pending OPS
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recharge Request History */}
          {requests.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm text-slate-700 mb-3">Recharge Request History</h3>
              <div className="rounded-xl border overflow-hidden bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Amount</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600">Receipt</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {requests.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-gray-900">{fmt(r.amount)}</td>
                        <td className="px-4 py-3 text-center">
                          {r.receipt_url
                            ? <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs hover:underline">View</a>
                            : <span className="text-slate-400 text-xs">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.status === 'approved' && <Badge className="bg-green-100 text-green-800 border-0 text-xs gap-1"><CheckCircle2 className="w-3 h-3" />Approved</Badge>}
                          {r.status === 'rejected' && (
                            <span title={r.rejection_reason ?? ''}>
                              <Badge className="bg-red-100 text-red-800 border-0 text-xs gap-1 cursor-help"><XCircle className="w-3 h-3" />Rejected</Badge>
                            </span>
                          )}
                          {r.status === 'pending' && <Badge className="bg-amber-100 text-amber-800 border-0 text-xs gap-1"><Clock className="w-3 h-3" />Pending</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transaction History */}
          <div>
            <h3 className="font-semibold text-sm text-slate-700 mb-3">Transaction History</h3>
            {txns.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-xl bg-white">
                <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Description</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Date</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600">Type</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {txns.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{t.reason ?? 'Transaction'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                          {new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={t.type === 'credit' ? 'bg-green-100 text-green-800 border-0' : 'bg-red-100 text-red-800 border-0'}>
                            {t.type === 'credit' ? 'Credit' : 'Debit'}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-right font-bold font-mono ${t.type === 'credit' ? 'text-green-700' : 'text-red-600'}`}>
                          {t.type === 'credit' ? '+' : '-'}{fmt(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Recharge Dialog */}
      <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-blue-600" /> Recharge Wallet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min="1"
                placeholder="Enter amount"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="text-lg font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Payment Receipt</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <FileImage className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm text-blue-800 flex-1 truncate">{file.name}</span>
                  <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} className="text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-200 rounded-lg px-4 py-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <Upload className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                  <p className="text-sm text-slate-500">Click to upload receipt</p>
                  <p className="text-xs text-slate-400 mt-0.5">Image or PDF</p>
                </button>
              )}
            </div>

            <p className="text-xs text-muted-foreground bg-slate-50 rounded-lg p-2.5">
              Request will go to OPS for approval. Balance will be updated once approved.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRechargeOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleRechargeSubmit} disabled={submitting}>
                {submitting
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : 'Submit Request'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

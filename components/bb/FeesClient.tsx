'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { PDFDownloadLink } from '@react-pdf/renderer'
import {
  IndianRupee, Plus, X, Search, ReceiptText, Download, AlertTriangle, Loader2,
} from 'lucide-react'
import { bbClient } from '@/lib/bb/db'
import { inr, inrShort } from '@/lib/bb/constants'
import { ReceiptPDF, type ReceiptData } from './ReceiptPDF'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Charge {
  id: string
  candidate_id: string
  charge_type: string
  basis: string
  percent: number | null
  salary_base: number | null
  amount: number
  due_date: string | null
  status: string
  amount_received: number
  notes: string | null
  created_at: string
  candidate_name: string
  candidate_phone: string
  candidate_city: string | null
  job_title: string | null
  company_name: string | null
}

export interface PaymentRow {
  id: string
  charge_id: string
  amount: number
  payment_mode: string
  payment_date: string
  reference_no: string | null
  receipt_number: string
  notes: string | null
  recorded_by_name: string
}

export interface CandidateOption {
  id: string
  full_name: string
  phone: string
  city: string | null
  placement_salary: number | null
  job_title: string | null
  company_name: string | null
  placement_id: string | null
}

const CHARGE_LABEL: Record<string, string> = {
  registration: 'Registration',
  placement: 'Placement fee',
  other: 'Other',
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pending:        { label: 'Pending',   cls: 'bg-slate-100 text-slate-700' },
  partially_paid: { label: 'Part paid', cls: 'bg-amber-100 text-amber-700' },
  paid:           { label: 'Paid',      cls: 'bg-green-100 text-green-700' },
  waived:         { label: 'Waived',    cls: 'bg-gray-100 text-gray-500' },
  refunded:       { label: 'Refunded',  cls: 'bg-red-100 text-red-700' },
}

const MODES = ['cash', 'upi', 'card', 'neft', 'rtgs', 'cheque', 'other']

export default function FeesClient({
  charges, payments, candidates, currentUserId, currentUserName, today, canWaive,
}: {
  charges: Charge[]
  payments: PaymentRow[]
  candidates: CandidateOption[]
  currentUserId: string
  currentUserName: string
  today: string
  canWaive: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'due' | 'paid'>('all')
  const [saving, setSaving] = useState(false)
  const [logo, setLogo] = useState('')

  const [chargeOpen, setChargeOpen] = useState(false)
  const [chargeForm, setChargeForm] = useState<any>({
    candidate_id: '', charge_type: 'registration', basis: 'fixed',
    amount: '', percent: '', due_date: '', notes: '',
  })

  const [paying, setPaying] = useState<Charge | null>(null)
  const [payForm, setPayForm] = useState<any>({ amount: '', payment_mode: 'cash', payment_date: '', reference_no: '', notes: '' })
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  const paymentsByCharge = payments.reduce<Record<string, PaymentRow[]>>((acc, p) => {
    ;(acc[p.charge_id] ??= []).push(p)
    return acc
  }, {})

  const outstanding = (c: Charge) => Math.max(0, Number(c.amount) - Number(c.amount_received))
  const isOpen = (c: Charge) => c.status === 'pending' || c.status === 'partially_paid'

  const shown = charges.filter(c => {
    if (filter === 'due' && !isOpen(c)) return false
    if (filter === 'paid' && c.status !== 'paid') return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [c.candidate_name, c.candidate_phone, c.job_title, c.company_name]
      .some(v => v?.toLowerCase().includes(q))
  })

  const billed = charges.reduce((s, c) => s + Number(c.amount), 0)
  const collected = charges.reduce((s, c) => s + Number(c.amount_received), 0)
  const due = charges.filter(isOpen).reduce((s, c) => s + outstanding(c), 0)

  /** The logo is embedded in the PDF, so it has to be inlined as a data URI. */
  async function ensureLogo(): Promise<string> {
    if (logo) return logo
    try {
      const blob = await fetch('/bb-mark.png').then(r => r.blob())
      const dataUri = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      setLogo(dataUri)
      return dataUri
    } catch {
      return ''
    }
  }

  const selectedCandidate = candidates.find(c => c.id === chargeForm.candidate_id)
  const previewAmount =
    chargeForm.basis === 'percent_of_salary'
      ? Math.round(((selectedCandidate?.placement_salary ?? 0) * Number(chargeForm.percent || 0)) / 100)
      : Number(chargeForm.amount || 0)

  async function saveCharge() {
    if (!chargeForm.candidate_id) { toast.error('Pick a candidate'); return }
    if (chargeForm.basis === 'percent_of_salary') {
      if (!selectedCandidate?.placement_salary) {
        toast.error('This candidate has no placement salary yet — use a fixed amount')
        return
      }
      if (!Number(chargeForm.percent)) { toast.error('Enter the percentage'); return }
    } else if (!Number(chargeForm.amount)) {
      toast.error('Enter the amount')
      return
    }

    setSaving(true)
    try {
      const db = bbClient()
      const { error } = await db.from('bb_candidate_charges').insert({
        candidate_id: chargeForm.candidate_id,
        placement_id: selectedCandidate?.placement_id ?? null,
        charge_type: chargeForm.charge_type,
        basis: chargeForm.basis,
        // A percentage charge stores the salary it was taken from, so the
        // figure can always be justified back to the candidate later.
        percent: chargeForm.basis === 'percent_of_salary' ? Number(chargeForm.percent) : null,
        salary_base: chargeForm.basis === 'percent_of_salary' ? selectedCandidate?.placement_salary : null,
        amount: previewAmount,
        due_date: chargeForm.due_date || null,
        notes: chargeForm.notes || null,
        created_by: currentUserId,
      })
      if (error) throw new Error(error.message)

      toast.success('Charge added')
      setChargeOpen(false)
      setChargeForm({ candidate_id: '', charge_type: 'registration', basis: 'fixed', amount: '', percent: '', due_date: '', notes: '' })
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  function openPayment(c: Charge) {
    setPaying(c)
    setPayForm({
      amount: String(outstanding(c)),
      payment_mode: 'cash',
      payment_date: today,
      reference_no: '',
      notes: '',
    })
  }

  async function recordPayment() {
    if (!paying) return
    const amount = Number(payForm.amount)
    if (!amount || amount <= 0) { toast.error('Enter the amount received'); return }
    if (amount > outstanding(paying) + 1) {
      toast.error(`That is more than the ${inr(outstanding(paying))} outstanding`)
      return
    }

    setSaving(true)
    try {
      const db = bbClient()
      // receipt_number and receipt_slug are filled by the database, so the
      // number can never be chosen here or collide with a parallel save.
      const { data, error } = await db.from('bb_candidate_payments').insert({
        charge_id: paying.id,
        candidate_id: paying.candidate_id,
        amount,
        payment_mode: payForm.payment_mode,
        payment_date: payForm.payment_date || today,
        reference_no: payForm.reference_no || null,
        notes: payForm.notes || null,
        recorded_by: currentUserId,
      }).select('receipt_number, payment_date, amount, payment_mode, reference_no, notes').single()
      if (error) throw new Error(error.message)

      await ensureLogo()
      setReceipt({
        receiptNumber: data.receipt_number,
        paymentDate: data.payment_date,
        amount: Number(data.amount),
        paymentMode: data.payment_mode,
        referenceNo: data.reference_no,
        notes: data.notes,
        candidateName: paying.candidate_name,
        candidatePhone: paying.candidate_phone,
        candidateCity: paying.candidate_city,
        chargeType: paying.charge_type,
        chargeAmount: Number(paying.amount),
        chargeReceived: Number(paying.amount_received) + amount,
        chargeNotes: paying.notes,
        jobTitle: paying.job_title,
        companyName: paying.company_name,
        recordedBy: currentUserName,
      })
      setPaying(null)
      toast.success(`Receipt ${data.receipt_number} generated`)
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record payment')
    } finally {
      setSaving(false)
    }
  }

  /** Re-open the receipt for a payment already taken. */
  async function reprint(c: Charge, p: PaymentRow) {
    await ensureLogo()
    setReceipt({
      receiptNumber: p.receipt_number,
      paymentDate: p.payment_date,
      amount: Number(p.amount),
      paymentMode: p.payment_mode,
      referenceNo: p.reference_no,
      notes: p.notes,
      candidateName: c.candidate_name,
      candidatePhone: c.candidate_phone,
      candidateCity: c.candidate_city,
      chargeType: c.charge_type,
      chargeAmount: Number(c.amount),
      chargeReceived: Number(c.amount_received),
      chargeNotes: c.notes,
      jobTitle: c.job_title,
      companyName: c.company_name,
      recordedBy: p.recorded_by_name,
    })
  }

  async function waive(c: Charge) {
    setSaving(true)
    try {
      const db = bbClient()
      const { error } = await db.from('bb_candidate_charges').update({ status: 'waived' }).eq('id', c.id)
      if (error) throw new Error(error.message)
      toast.success('Charge waived')
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not waive')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Billed to candidates', value: billed, tone: 'text-gray-900' },
          { label: 'Collected', value: collected, tone: 'text-green-700' },
          { label: 'Outstanding', value: due, tone: due > 0 ? 'text-amber-700' : 'text-gray-400' },
        ].map(m => (
          <div key={m.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{m.label}</p>
            <p className={`text-3xl font-bold mt-1.5 tabular-nums ${m.tone}`}>{inrShort(m.value)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search candidate, phone, company…"
            className="w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
          {([['all', 'All'], ['due', 'Outstanding'], ['paid', 'Paid']] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold ${filter === k ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={() => setChargeOpen(true)}
          disabled={candidates.length === 0}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add charge
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <IndianRupee className="w-7 h-7 mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-700">
            {charges.length === 0 ? 'No candidate charges yet' : 'Nothing here'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {charges.length === 0
              ? 'Add a registration or placement charge, then record what the candidate pays. Every payment prints a numbered receipt.'
              : 'Try another filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(c => {
            const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.pending
            const rows = paymentsByCharge[c.id] ?? []
            const overdue = isOpen(c) && c.due_date && c.due_date < today
            return (
              <div key={c.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{c.candidate_name}</h3>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {CHARGE_LABEL[c.charge_type] ?? c.charge_type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.candidate_phone}
                      {c.job_title ? ` · ${c.job_title}` : ''}
                      {c.company_name ? ` @ ${c.company_name}` : ''}
                    </p>
                    {c.basis === 'percent_of_salary' && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.percent}% of {inr(c.salary_base ?? 0)} salary
                      </p>
                    )}
                    {c.notes && <p className="text-xs text-gray-400 mt-0.5">{c.notes}</p>}
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900 tabular-nums">{inr(c.amount)}</p>
                    <p className="text-xs text-gray-500">
                      paid {inr(c.amount_received)}
                      {outstanding(c) > 0 && <> · due <b className="text-amber-700">{inr(outstanding(c))}</b></>}
                    </p>
                    {overdue && (
                      <p className="text-[11px] text-red-600 font-semibold inline-flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3" /> overdue {format(parseISO(c.due_date!), 'dd MMM')}
                      </p>
                    )}
                  </div>
                </div>

                {rows.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                    {rows.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="inline-flex items-center gap-1.5 text-gray-600">
                          <ReceiptText className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-mono">{p.receipt_number}</span>
                          <span className="text-gray-400">
                            {format(parseISO(p.payment_date), 'dd MMM yyyy')} · {p.payment_mode}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <b className="text-gray-900 tabular-nums">{inr(p.amount)}</b>
                          <button
                            onClick={() => reprint(c, p)}
                            className="text-emerald-700 hover:underline font-semibold"
                          >
                            Receipt
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-3">
                  {canWaive && isOpen(c) && (
                    <button
                      onClick={() => waive(c)}
                      disabled={saving}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                    >
                      Waive
                    </button>
                  )}
                  {isOpen(c) && (
                    <button
                      onClick={() => openPayment(c)}
                      className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Record payment
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---------------------------------------------------- receipt --- */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReceipt(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center mx-auto">
              <ReceiptText className="w-6 h-6 text-green-700" />
            </div>
            <h2 className="font-bold text-gray-900 mt-4">Receipt ready</h2>
            <p className="text-sm text-gray-500 mt-1">
              <span className="font-mono">{receipt.receiptNumber}</span> · {inr(receipt.amount)} from {receipt.candidateName}
            </p>

            <div className="mt-5 space-y-2">
              <PDFDownloadLink
                document={<ReceiptPDF data={receipt} logoBase64={logo} />}
                fileName={`Receipt_${receipt.receiptNumber.replace(/\//g, '-')}.pdf`}
              >
                {({ loading }) => (
                  <span className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {loading ? 'Preparing…' : 'Download receipt'}
                  </span>
                )}
              </PDFDownloadLink>
              <button
                onClick={() => setReceipt(null)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ payment form --- */}
      {paying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPaying(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Record payment</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {paying.candidate_name} · {inr(outstanding(paying))} outstanding
                </p>
              </div>
              <button onClick={() => setPaying(null)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount received">
                  <input type="number" className={inputCls} value={payForm.amount} onChange={e => setPayForm((f: any) => ({ ...f, amount: e.target.value }))} />
                </Field>
                <Field label="Mode">
                  <select className={inputCls} value={payForm.payment_mode} onChange={e => setPayForm((f: any) => ({ ...f, payment_mode: e.target.value }))}>
                    {MODES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input type="date" className={inputCls} value={payForm.payment_date} onChange={e => setPayForm((f: any) => ({ ...f, payment_date: e.target.value }))} />
                </Field>
                <Field label="Reference / UTR">
                  <input className={inputCls} value={payForm.reference_no} onChange={e => setPayForm((f: any) => ({ ...f, reference_no: e.target.value }))} />
                </Field>
              </div>
              <Field label="Note">
                <input className={inputCls} value={payForm.notes} onChange={e => setPayForm((f: any) => ({ ...f, notes: e.target.value }))} />
              </Field>
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3">
                A numbered receipt is generated the moment this is saved, and stays available to
                re-download later.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setPaying(null)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={recordPayment} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save & make receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------- charge form --- */}
      {chargeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setChargeOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h2 className="font-bold text-gray-900">Add a charge</h2>
              <button onClick={() => setChargeOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-5">
              <Field label="Candidate" required>
                <select className={inputCls} value={chargeForm.candidate_id} onChange={e => setChargeForm((f: any) => ({ ...f, candidate_id: e.target.value }))}>
                  <option value="">Select…</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} — {c.phone}{c.placement_salary ? ` (placed, ${inr(c.placement_salary)})` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Charge for">
                  <select className={inputCls} value={chargeForm.charge_type} onChange={e => setChargeForm((f: any) => ({ ...f, charge_type: e.target.value }))}>
                    <option value="registration">Registration</option>
                    <option value="placement">Placement fee</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="How it is calculated">
                  <select className={inputCls} value={chargeForm.basis} onChange={e => setChargeForm((f: any) => ({ ...f, basis: e.target.value }))}>
                    <option value="fixed">Fixed amount</option>
                    <option value="percent_of_salary">% of their salary</option>
                  </select>
                </Field>
              </div>

              {chargeForm.basis === 'fixed' ? (
                <Field label="Amount (₹)" required>
                  <input type="number" className={inputCls} value={chargeForm.amount} onChange={e => setChargeForm((f: any) => ({ ...f, amount: e.target.value }))} />
                </Field>
              ) : (
                <>
                  <Field label="Percentage of salary" required>
                    <input type="number" step="0.01" className={inputCls} value={chargeForm.percent} onChange={e => setChargeForm((f: any) => ({ ...f, percent: e.target.value }))} />
                  </Field>
                  {selectedCandidate?.placement_salary ? (
                    <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-3">
                      {chargeForm.percent || 0}% of {inr(selectedCandidate.placement_salary)} ={' '}
                      <b className="text-emerald-700">{inr(previewAmount)}</b>
                    </p>
                  ) : (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      This candidate has no placement yet, so there is no salary to take a
                      percentage of. Use a fixed amount, or add this charge after they join.
                    </p>
                  )}
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Due date">
                  <input type="date" className={inputCls} value={chargeForm.due_date} onChange={e => setChargeForm((f: any) => ({ ...f, due_date: e.target.value }))} />
                </Field>
                <Field label="Note">
                  <input className={inputCls} value={chargeForm.notes} onChange={e => setChargeForm((f: any) => ({ ...f, notes: e.target.value }))} />
                </Field>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setChargeOpen(false)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={saveCharge} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add charge'}
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}

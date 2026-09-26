'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { BadgeCheck, ShieldCheck, ShieldAlert, UserMinus, X } from 'lucide-react'
import { bbClient } from '@/lib/bb/db'
import { inr } from '@/lib/bb/constants'
import { describeTerms } from '@/lib/bb/commission'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Placement {
  id: string
  joined_on: string
  offered_salary: number
  salary_period: string
  commission_type: string
  commission_percent: number | null
  commission_base: string | null
  commission_months: number
  commission_fixed_amount: number | null
  total_commission: number
  guarantee_days: number
  status: string
  left_on: string | null
  left_reason: string | null
  candidate_name: string
  candidate_phone: string
  company_name: string
  job_title: string
  invoiced: number
  received: number
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  left: 'bg-red-100 text-red-700',
  replaced: 'bg-amber-100 text-amber-700',
}

export default function PlacementsClient({
  placements, canEdit,
}: { placements: Placement[]; canEdit: boolean }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [leaving, setLeaving] = useState<Placement | null>(null)
  const [leftOn, setLeftOn] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function confirmLeft() {
    if (!leaving || !leftOn) { toast.error('Pick the last working date'); return }
    setSaving(true)
    try {
      const db = bbClient()
      const { error } = await db
        .from('bb_placements')
        .update({ status: 'left', left_on: leftOn, left_reason: reason || null })
        .eq('id', leaving.id)
      if (error) throw new Error(error.message)

      const withinGuarantee =
        differenceInCalendarDays(parseISO(leftOn), parseISO(leaving.joined_on)) <= leaving.guarantee_days

      toast.success(
        withinGuarantee
          ? 'Marked as left — inside the guarantee window, so a replacement is owed'
          : 'Marked as left'
      )
      setLeaving(null)
      setReason('')
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update')
    } finally {
      setSaving(false)
    }
  }

  if (placements.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <BadgeCheck className="w-7 h-7 mx-auto text-gray-300" />
        <p className="mt-3 font-semibold text-gray-700">No placements yet</p>
        <p className="text-sm text-gray-500 mt-1">
          Mark a candidate joined on the Pipeline board and they land here.
        </p>
      </div>
    )
  }

  const today = new Date()

  return (
    <div className="space-y-3">
      {placements.map(p => {
        const daysIn = differenceInCalendarDays(today, parseISO(p.joined_on))
        const guaranteeLeft = p.guarantee_days - daysIn
        const inGuarantee = p.status === 'active' && guaranteeLeft > 0
        const collectedPct = p.invoiced > 0 ? Math.round((p.received / p.invoiced) * 100) : 0

        return (
          <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">{p.candidate_name}</h3>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">
                  {p.job_title} · <span className="text-gray-500">{p.company_name}</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Joined {format(parseISO(p.joined_on), 'dd MMM yyyy')}
                  {p.left_on && ` · left ${format(parseISO(p.left_on), 'dd MMM yyyy')}`}
                </p>
              </div>

              {canEdit && p.status === 'active' && (
                <button
                  onClick={() => { setLeaving(p); setLeftOn(new Date().toISOString().slice(0, 10)) }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                >
                  <UserMinus className="w-3.5 h-3.5" /> Mark left
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-4 mt-4 pt-4 border-t border-gray-100">
              <Stat label="Salary" value={`${inr(p.offered_salary)}${p.salary_period === 'annual' ? '/yr' : '/mo'}`} />
              <Stat label="Commission" value={inr(p.total_commission)} tone="text-emerald-700" />
              <Stat label="Received" value={`${inr(p.received)} (${collectedPct}%)`} tone={collectedPct === 100 ? 'text-green-700' : 'text-gray-900'} />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Guarantee</p>
                {p.status !== 'active' ? (
                  <p className="text-sm font-semibold text-gray-400 mt-0.5">—</p>
                ) : inGuarantee ? (
                  <p className="text-sm font-semibold text-amber-700 mt-0.5 inline-flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> {guaranteeLeft}d left
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-green-700 mt-0.5 inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Passed
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Deal locked at placement:{' '}
              <b className="text-gray-700">
                {describeTerms({
                  type: p.commission_type as any,
                  percent: p.commission_percent,
                  base: p.commission_base as any,
                  months: p.commission_months,
                  fixedAmount: p.commission_fixed_amount,
                })}
              </b>
            </p>
          </div>
        )
      })}

      {leaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setLeaving(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Mark as left</h2>
                <p className="text-sm text-gray-500 mt-0.5">{leaving.candidate_name} · {leaving.company_name}</p>
              </div>
              <button onClick={() => setLeaving(null)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-5">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-gray-600">Last working date</span>
                <input type="date" className={inputCls} value={leftOn} onChange={e => setLeftOn(e.target.value)} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-gray-600">Reason</span>
                <textarea rows={2} className={inputCls} value={reason} onChange={e => setReason(e.target.value)} />
              </label>

              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3">
                Invoices already raised stay as they are — whether the client is owed a refund or a
                replacement is a decision for the Revenue screen, not an automatic write-off.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setLeaving(null)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={confirmLeft} disabled={saving} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone = 'text-gray-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-sm font-bold mt-0.5 tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none'

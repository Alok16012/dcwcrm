'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { KanbanSquare, X, BadgeCheck, Phone, Building2 } from 'lucide-react'
import { bbClient } from '@/lib/bb/db'
import { APPLICATION_STAGES, STAGE_STYLE, inr } from '@/lib/bb/constants'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Application {
  id: string
  candidate_id: string
  job_id: string
  company_id: string
  stage: string
  interview_at: string | null
  offered_salary: number | null
  created_at: string
  candidate_name: string
  candidate_phone: string
  job_title: string
  company_name: string
  salary_period: string
  job_salary_max: number | null
}

export default function PipelineClient({
  applications, currentUserId, canPlace,
}: { applications: Application[]; currentUserId: string; canPlace: boolean }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [joining, setJoining] = useState<Application | null>(null)
  const [saving, setSaving] = useState(false)
  const [joinForm, setJoinForm] = useState({ joined_on: '', offered_salary: '', salary_period: 'monthly' })

  const byStage = APPLICATION_STAGES.map(stage => ({
    stage,
    items: applications.filter(a => a.stage === stage),
  }))
  const closed = applications.filter(a => ['rejected', 'dropped'].includes(a.stage))

  async function moveStage(app: Application, stage: string) {
    // Joining is not a stage change — it creates money, so it goes through the
    // placement flow instead of a bare update.
    if (stage === 'joined') {
      if (!canPlace) {
        toast.error('Only a manager can mark someone joined')
        return
      }
      setJoining(app)
      setJoinForm({
        joined_on: new Date().toISOString().slice(0, 10),
        offered_salary: String(app.offered_salary ?? app.job_salary_max ?? ''),
        salary_period: app.salary_period ?? 'monthly',
      })
      return
    }

    setBusy(app.id)
    try {
      const db = bbClient()
      const { error } = await db.from('bb_applications').update({ stage }).eq('id', app.id)
      if (error) throw new Error(error.message)
      await db.from('bb_activities').insert({
        candidate_id: app.candidate_id,
        application_id: app.id,
        activity_type: 'stage_changed',
        old_value: app.stage,
        new_value: stage,
        performed_by: currentUserId,
      })
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not move')
    } finally {
      setBusy(null)
    }
  }

  async function confirmJoin() {
    if (!joining) return
    if (!joinForm.joined_on) { toast.error('Joining date is required'); return }
    const salary = Number(joinForm.offered_salary)
    if (!salary || salary <= 0) { toast.error('Enter the offered salary'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/bb/placements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          application_id: joining.id,
          joined_on: joinForm.joined_on,
          offered_salary: salary,
          salary_period: joinForm.salary_period,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not record the placement')

      toast.success(
        `Placed — ${inr(json.total_commission)} commission across ${json.invoices} invoice${json.invoices > 1 ? 's' : ''}`
      )
      setJoining(null)
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record the placement')
    } finally {
      setSaving(false)
    }
  }

  if (applications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <KanbanSquare className="w-7 h-7 mx-auto text-gray-300" />
        <p className="mt-3 font-semibold text-gray-700">Pipeline is empty</p>
        <p className="text-sm text-gray-500 mt-1">
          Send a candidate to a job from the Candidates screen and they show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {byStage.map(({ stage, items }) => {
            const style = STAGE_STYLE[stage]
            return (
              <div key={stage} className="w-64 shrink-0">
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-gray-700">
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    {style.label}
                  </span>
                  <span className="text-xs font-bold text-gray-400 tabular-nums">{items.length}</span>
                </div>

                <div className="space-y-2 rounded-2xl bg-gray-100/70 p-2 min-h-[120px]">
                  {items.map(a => (
                    <div
                      key={a.id}
                      className={`rounded-xl bg-white border border-gray-200 p-3 shadow-sm ${busy === a.id ? 'opacity-50' : ''}`}
                    >
                      <p className="font-semibold text-sm text-gray-900 truncate">{a.candidate_name}</p>
                      <p className="text-[11px] text-gray-500 inline-flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {a.candidate_phone}
                      </p>

                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-700 truncate">{a.job_title}</p>
                        <p className="text-[11px] text-gray-500 inline-flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 shrink-0" /> {a.company_name}
                        </p>
                      </div>

                      {a.interview_at && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-2 inline-block">
                          {format(parseISO(a.interview_at), 'dd MMM, hh:mm a')}
                        </p>
                      )}

                      <select
                        value={a.stage}
                        onChange={e => moveStage(a, e.target.value)}
                        className="mt-2 w-full text-[11px] font-semibold rounded-lg border border-gray-200 px-2 py-1.5 bg-white cursor-pointer"
                      >
                        {APPLICATION_STAGES.map(s => (
                          <option key={s} value={s}>{STAGE_STYLE[s].label}</option>
                        ))}
                        <option value="rejected">Rejected</option>
                        <option value="dropped">Dropped</option>
                      </select>
                    </div>
                  ))}

                  {items.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6">Empty</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {closed.length > 0 && (
        <details className="rounded-2xl border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">
            Closed ({closed.length}) — rejected and dropped
          </summary>
          <ul className="mt-3 divide-y divide-gray-100">
            {closed.map(a => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-700">{a.candidate_name}</span>
                <span className="text-xs text-gray-500 truncate">{a.job_title} · {a.company_name}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STAGE_STYLE[a.stage].cls}`}>
                  {STAGE_STYLE[a.stage].label}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* ---------------------------------------------- mark joined ------ */}
      {joining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setJoining(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6">
              <div>
                <h2 className="font-bold text-gray-900 inline-flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5 text-emerald-600" /> Mark as joined
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {joining.candidate_name} → {joining.job_title}
                </p>
              </div>
              <button onClick={() => setJoining(null)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-gray-600">Joining date</span>
                <input
                  type="date"
                  className={inputCls}
                  value={joinForm.joined_on}
                  onChange={e => setJoinForm(f => ({ ...f, joined_on: e.target.value }))}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-gray-600">Offered salary</span>
                  <input
                    type="number"
                    className={inputCls}
                    value={joinForm.offered_salary}
                    onChange={e => setJoinForm(f => ({ ...f, offered_salary: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-gray-600">Period</span>
                  <select
                    className={inputCls}
                    value={joinForm.salary_period}
                    onChange={e => setJoinForm(f => ({ ...f, salary_period: e.target.value }))}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </label>
              </div>

              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3">
                The company&apos;s commission terms are locked onto this placement now, and the
                invoices are created straight away. Changing the deal later will not touch them.
              </p>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setJoining(null)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={confirmJoin} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Recording…' : 'Confirm joining'}
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

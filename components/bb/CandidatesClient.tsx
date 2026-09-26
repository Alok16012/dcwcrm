'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import {
  Users, Plus, Search, X, Phone, Send, CalendarClock, UserCheck,
} from 'lucide-react'
import { bbClient } from '@/lib/bb/db'
import { CANDIDATE_STATUS_STYLE, CANDIDATE_STATUSES, CANDIDATE_SOURCES, inr } from '@/lib/bb/constants'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Candidate {
  id: string
  full_name: string
  phone: string
  email: string | null
  city: string | null
  state: string | null
  qualification: string | null
  experience_years: number | null
  current_salary: number | null
  expected_salary: number | null
  source: string
  status: string
  assigned_to: string | null
  next_followup_date: string | null
  notes: string | null
  created_at: string
  assigned_name?: string
  applications?: number
}

export interface Person { id: string; full_name: string }
export interface JobOption { id: string; title: string; company_id: string; company_name: string }

const EMPTY: Partial<Candidate> = {
  full_name: '', phone: '', email: '', city: '', state: '',
  qualification: '', experience_years: null,
  current_salary: null, expected_salary: null,
  source: 'phone', status: 'new', notes: '',
}

export default function CandidatesClient({
  candidates, telecallers, jobs, currentUserId, canAssign,
}: {
  candidates: Candidate[]
  telecallers: Person[]
  jobs: JobOption[]
  currentUserId: string
  canAssign: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Candidate>>(EMPTY)
  const [applyFor, setApplyFor] = useState<Candidate | null>(null)
  const [applyJobId, setApplyJobId] = useState('')
  const [busyRow, setBusyRow] = useState<string | null>(null)

  const filtered = candidates.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [c.full_name, c.phone, c.email, c.city, c.qualification]
      .some(v => v?.toLowerCase().includes(q))
  })

  const set = (patch: Partial<Candidate>) => setForm(f => ({ ...f, ...patch }))

  function create() { setForm({ ...EMPTY }); setOpen(true) }
  function edit(c: Candidate) { setForm({ ...c }); setOpen(true) }

  async function save() {
    if (!form.full_name?.trim()) { toast.error('Name is required'); return }
    if (!form.phone?.trim()) { toast.error('Phone is required'); return }

    setSaving(true)
    try {
      const db = bbClient()
      const payload: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email || null,
        city: form.city || null,
        state: form.state || null,
        qualification: form.qualification || null,
        experience_years: form.experience_years ? Number(form.experience_years) : null,
        current_salary: form.current_salary ? Number(form.current_salary) : null,
        expected_salary: form.expected_salary ? Number(form.expected_salary) : null,
        source: form.source ?? 'phone',
        status: form.status ?? 'new',
        next_followup_date: form.next_followup_date || null,
        notes: form.notes || null,
      }

      if (form.id) {
        const { error } = await db.from('bb_candidates').update(payload).eq('id', form.id)
        if (error) throw new Error(error.message)
      } else {
        // A new candidate belongs to whoever entered them until reassigned —
        // an unassigned lead is a lead nobody calls.
        payload.assigned_to = currentUserId
        payload.assigned_at = new Date().toISOString()
        payload.created_by = currentUserId
        const { data, error } = await db.from('bb_candidates').insert(payload).select('id').single()
        if (error) {
          throw new Error(
            error.message.includes('duplicate')
              ? 'That phone number is already in the system'
              : error.message
          )
        }
        await db.from('bb_activities').insert({
          candidate_id: data.id,
          activity_type: 'created',
          note: `Added from ${payload.source}`,
          performed_by: currentUserId,
        })
      }

      toast.success(form.id ? 'Candidate updated' : 'Candidate added')
      setOpen(false)
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  /** Status changes are logged, so the call history explains itself later. */
  async function changeStatus(c: Candidate, status: string) {
    setBusyRow(c.id)
    try {
      const db = bbClient()
      const { error } = await db.from('bb_candidates').update({ status }).eq('id', c.id)
      if (error) throw new Error(error.message)
      await db.from('bb_activities').insert({
        candidate_id: c.id,
        activity_type: 'status_changed',
        old_value: c.status,
        new_value: status,
        performed_by: currentUserId,
      })
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update')
    } finally {
      setBusyRow(null)
    }
  }

  async function assign(c: Candidate, to: string) {
    setBusyRow(c.id)
    try {
      const db = bbClient()
      const { error } = await db
        .from('bb_candidates')
        .update({ assigned_to: to || null, assigned_at: new Date().toISOString() })
        .eq('id', c.id)
      if (error) throw new Error(error.message)
      await db.from('bb_activities').insert({
        candidate_id: c.id,
        activity_type: 'assigned',
        new_value: telecallers.find(t => t.id === to)?.full_name ?? 'Unassigned',
        performed_by: currentUserId,
      })
      toast.success('Reassigned')
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reassign')
    } finally {
      setBusyRow(null)
    }
  }

  async function submitApplication() {
    if (!applyFor || !applyJobId) { toast.error('Pick a job'); return }
    const job = jobs.find(j => j.id === applyJobId)
    if (!job) return

    setSaving(true)
    try {
      const db = bbClient()
      const { error } = await db.from('bb_applications').insert({
        candidate_id: applyFor.id,
        job_id: job.id,
        company_id: job.company_id,
        stage: 'applied',
        created_by: currentUserId,
      })
      if (error) {
        throw new Error(
          error.message.includes('duplicate')
            ? 'Already sent to this job'
            : error.message
        )
      }

      await db.from('bb_activities').insert({
        candidate_id: applyFor.id,
        activity_type: 'applied',
        new_value: `${job.title} @ ${job.company_name}`,
        performed_by: currentUserId,
      })
      // Moving the candidate along too, so the list reflects reality without a
      // second manual edit.
      if (['new', 'contacted', 'interested'].includes(applyFor.status)) {
        await db.from('bb_candidates').update({ status: 'screening' }).eq('id', applyFor.id)
      }

      toast.success(`Sent to ${job.title}`)
      setApplyFor(null)
      setApplyJobId('')
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, phone, city…"
            className="w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">All statuses</option>
          {CANDIDATE_STATUSES.map(s => (
            <option key={s} value={s}>{CANDIDATE_STATUS_STYLE[s].label}</option>
          ))}
        </select>
        <button
          onClick={create}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" /> Add candidate
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Users className="w-7 h-7 mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-700">
            {candidates.length === 0 ? 'No candidates yet' : 'No match'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {candidates.length === 0 ? 'Every placement starts with one.' : 'Try a different search.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Candidate</th>
                  <th className="px-4 py-2.5 font-semibold">Profile</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Owner</th>
                  <th className="px-4 py-2.5 font-semibold">Follow-up</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => {
                  const st = CANDIDATE_STATUS_STYLE[c.status] ?? CANDIDATE_STATUS_STYLE.new
                  return (
                    <tr key={c.id} className={`hover:bg-gray-50 ${busyRow === c.id ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => edit(c)} className="text-left">
                          <p className="font-semibold text-gray-900 hover:text-emerald-700">{c.full_name}</p>
                          <p className="text-xs text-gray-500 inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {c.phone}
                          </p>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <p>{c.qualification || '—'}</p>
                        <p className="text-gray-400">
                          {c.experience_years != null ? `${c.experience_years} yrs` : 'Fresher'}
                          {c.expected_salary ? ` · wants ${inr(c.expected_salary)}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={c.status}
                          onChange={e => changeStatus(c, e.target.value)}
                          className={`text-[11px] font-bold px-2 py-1 rounded-full border-0 cursor-pointer ${st.cls}`}
                        >
                          {CANDIDATE_STATUSES.map(s => (
                            <option key={s} value={s}>{CANDIDATE_STATUS_STYLE[s].label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {canAssign ? (
                          <select
                            value={c.assigned_to ?? ''}
                            onChange={e => assign(c, e.target.value)}
                            className="text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white max-w-[140px]"
                          >
                            <option value="">Unassigned</option>
                            {telecallers.map(t => (
                              <option key={t.id} value={t.id}>{t.full_name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-600">{c.assigned_name ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {c.next_followup_date ? (
                          <span className="inline-flex items-center gap-1 text-gray-600">
                            <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
                            {format(parseISO(c.next_followup_date), 'dd MMM')}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setApplyFor(c); setApplyJobId(jobs[0]?.id ?? '') }}
                          disabled={jobs.length === 0}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 disabled:opacity-40"
                        >
                          <Send className="w-3.5 h-3.5" /> Send to job
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------- apply modal --- */}
      {applyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setApplyFor(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <h2 className="font-bold text-gray-900">Send to a job</h2>
            <p className="text-sm text-gray-500 mt-0.5">{applyFor.full_name} · {applyFor.phone}</p>

            <label className="block mt-5 space-y-1.5">
              <span className="text-xs font-medium text-gray-600">Job</span>
              <select className={inputCls} value={applyJobId} onChange={e => setApplyJobId(e.target.value)}>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>{j.title} — {j.company_name}</option>
                ))}
              </select>
            </label>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setApplyFor(null)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={submitApplication} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------- form panel --- */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative ml-auto w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{form.id ? 'Edit candidate' : 'Add candidate'}</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <Field label="Full name" required>
                <input className={inputCls} value={form.full_name ?? ''} onChange={e => set({ full_name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone" required>
                  <input className={inputCls} value={form.phone ?? ''} onChange={e => set({ phone: e.target.value })} />
                </Field>
                <Field label="Email">
                  <input className={inputCls} value={form.email ?? ''} onChange={e => set({ email: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input className={inputCls} value={form.city ?? ''} onChange={e => set({ city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input className={inputCls} value={form.state ?? ''} onChange={e => set({ state: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Qualification">
                  <input className={inputCls} value={form.qualification ?? ''} onChange={e => set({ qualification: e.target.value })} />
                </Field>
                <Field label="Experience (yrs)">
                  <input type="number" step="0.5" className={inputCls} value={form.experience_years ?? ''} onChange={e => set({ experience_years: Number(e.target.value) })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Current salary">
                  <input type="number" className={inputCls} value={form.current_salary ?? ''} onChange={e => set({ current_salary: Number(e.target.value) })} />
                </Field>
                <Field label="Expected salary">
                  <input type="number" className={inputCls} value={form.expected_salary ?? ''} onChange={e => set({ expected_salary: Number(e.target.value) })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Source">
                  <select className={inputCls} value={form.source ?? 'phone'} onChange={e => set({ source: e.target.value })}>
                    {CANDIDATE_SOURCES.map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Next follow-up">
                  <input type="date" className={inputCls} value={form.next_followup_date ?? ''} onChange={e => set({ next_followup_date: e.target.value })} />
                </Field>
              </div>
              <Field label="Notes">
                <textarea rows={3} className={inputCls} value={form.notes ?? ''} onChange={e => set({ notes: e.target.value })} />
              </Field>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4 flex gap-3">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add candidate'}
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

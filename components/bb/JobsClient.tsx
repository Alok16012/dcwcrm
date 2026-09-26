'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BriefcaseBusiness, Plus, Pencil, Search, X, MapPin, Users2 } from 'lucide-react'
import { bbClient } from '@/lib/bb/db'
import { inr } from '@/lib/bb/constants'
import { describeTerms, resolveTerms } from '@/lib/bb/commission'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Job {
  id: string
  company_id: string
  title: string
  department: string | null
  description: string | null
  openings: number
  salary_min: number | null
  salary_max: number | null
  salary_period: string
  location_city: string | null
  location_state: string | null
  job_type: string
  experience_min_years: number | null
  experience_max_years: number | null
  qualification: string | null
  status: string
  commission_type: string | null
  commission_percent: number | null
  commission_base: string | null
  commission_months: number | null
  commission_fixed_amount: number | null
  closes_on: string | null
  company_name?: string
  filled?: number
}

export interface CompanyOption {
  id: string
  name: string
  commission_type: string
  commission_percent: number | null
  commission_base: string | null
  commission_months: number | null
  commission_fixed_amount: number | null
}

const EMPTY: Partial<Job> = {
  title: '', department: '', openings: 1,
  salary_min: null, salary_max: null, salary_period: 'monthly',
  location_city: '', location_state: '', job_type: 'full_time',
  experience_min_years: null, experience_max_years: null,
  qualification: '', status: 'open', description: '',
  commission_type: null,
}

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  on_hold: 'bg-amber-100 text-amber-700',
  closed: 'bg-gray-100 text-gray-500',
  filled: 'bg-blue-100 text-blue-700',
}

const JOB_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full time', part_time: 'Part time',
  contract: 'Contract', internship: 'Internship',
}

export default function JobsClient({
  jobs, companies, canEdit,
}: { jobs: Job[]; companies: CompanyOption[]; canEdit: boolean }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [overrideDeal, setOverrideDeal] = useState(false)
  const [form, setForm] = useState<Partial<Job>>(EMPTY)

  const filtered = jobs.filter(j => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [j.title, j.company_name, j.location_city, j.department]
      .some(v => v?.toLowerCase().includes(q))
  })

  function create() {
    setForm({ ...EMPTY, company_id: companies[0]?.id })
    setOverrideDeal(false)
    setOpen(true)
  }

  function edit(j: Job) {
    setForm({ ...j })
    setOverrideDeal(!!j.commission_type)
    setOpen(true)
  }

  const set = (patch: Partial<Job>) => setForm(f => ({ ...f, ...patch }))

  async function save() {
    if (!form.company_id) { toast.error('Pick a company'); return }
    if (!form.title?.trim()) { toast.error('Job title is required'); return }

    setSaving(true)
    try {
      const db = bbClient()
      const payload: Record<string, unknown> = {
        company_id: form.company_id,
        title: form.title.trim(),
        department: form.department || null,
        description: form.description || null,
        openings: Number(form.openings ?? 1),
        salary_min: form.salary_min ? Number(form.salary_min) : null,
        salary_max: form.salary_max ? Number(form.salary_max) : null,
        salary_period: form.salary_period ?? 'monthly',
        location_city: form.location_city || null,
        location_state: form.location_state || null,
        job_type: form.job_type ?? 'full_time',
        experience_min_years: form.experience_min_years ? Number(form.experience_min_years) : null,
        experience_max_years: form.experience_max_years ? Number(form.experience_max_years) : null,
        qualification: form.qualification || null,
        status: form.status ?? 'open',
        closes_on: form.closes_on || null,
        // Clearing the override must null the whole set, or a stale percentage
        // would linger and re-activate the next time a type is picked.
        commission_type: overrideDeal ? (form.commission_type ?? 'percent_of_salary') : null,
        commission_percent: overrideDeal && form.commission_type !== 'fixed_per_hire'
          ? Number(form.commission_percent ?? 0) : null,
        commission_base: overrideDeal && form.commission_type !== 'fixed_per_hire'
          ? (form.commission_base ?? 'first_month') : null,
        commission_months: overrideDeal && form.commission_base === 'monthly'
          ? Number(form.commission_months ?? 1) : null,
        commission_fixed_amount: overrideDeal && form.commission_type === 'fixed_per_hire'
          ? Number(form.commission_fixed_amount ?? 0) : null,
      }

      const { error } = form.id
        ? await db.from('bb_jobs').update(payload).eq('id', form.id)
        : await db.from('bb_jobs').insert(payload)
      if (error) throw new Error(error.message)

      toast.success(form.id ? 'Job updated' : 'Job posted')
      setOpen(false)
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const selectedCompany = companies.find(c => c.id === form.company_id)
  const effectiveTerms = selectedCompany
    ? resolveTerms(selectedCompany as any, overrideDeal ? (form as any) : null)
    : null

  function salaryText(j: Job): string {
    if (!j.salary_min && !j.salary_max) return 'Not disclosed'
    const suffix = j.salary_period === 'annual' ? '/yr' : '/mo'
    if (j.salary_min && j.salary_max) return `${inr(j.salary_min)} – ${inr(j.salary_max)}${suffix}`
    return `${inr(j.salary_min ?? j.salary_max)}${suffix}`
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search jobs, companies, cities…"
            className="w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="on_hold">On hold</option>
          <option value="filled">Filled</option>
          <option value="closed">Closed</option>
        </select>
        {canEdit && (
          <button
            onClick={create}
            disabled={companies.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Post job
          </button>
        )}
      </div>

      {companies.length === 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Add a company first — a job has to belong to one.
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <BriefcaseBusiness className="w-7 h-7 mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-700">
            {jobs.length === 0 ? 'No jobs posted yet' : 'No match'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(j => (
            <div key={j.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">{j.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{j.company_name}</p>
                </div>
                <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[j.status]}`}>
                  {j.status.replace('_', ' ')}
                </span>
              </div>

              <p className="text-sm font-semibold text-gray-900 mt-3">{salaryText(j)}</p>

              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[j.location_city, j.location_state].filter(Boolean).join(', ') || '—'}
                </span>
                <span>{JOB_TYPE_LABEL[j.job_type] ?? j.job_type}</span>
                {(j.experience_min_years != null || j.experience_max_years != null) && (
                  <span>{j.experience_min_years ?? 0}–{j.experience_max_years ?? '+'} yrs</span>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                  <Users2 className="w-3.5 h-3.5" />
                  <b className="text-gray-900">{j.filled ?? 0}</b> / {j.openings} filled
                </span>
                {canEdit && (
                  <button
                    onClick={() => edit(j)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-emerald-700"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative ml-auto w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{form.id ? 'Edit job' : 'Post a job'}</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <Field label="Company" required>
                <select className={inputCls} value={form.company_id ?? ''} onChange={e => set({ company_id: e.target.value })}>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>

              <Field label="Job title" required>
                <input className={inputCls} value={form.title ?? ''} onChange={e => set({ title: e.target.value })} placeholder="Field Sales Executive" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Department">
                  <input className={inputCls} value={form.department ?? ''} onChange={e => set({ department: e.target.value })} />
                </Field>
                <Field label="Openings">
                  <input type="number" min={1} className={inputCls} value={form.openings ?? 1} onChange={e => set({ openings: Number(e.target.value) })} />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Salary min">
                  <input type="number" className={inputCls} value={form.salary_min ?? ''} onChange={e => set({ salary_min: Number(e.target.value) })} />
                </Field>
                <Field label="Salary max">
                  <input type="number" className={inputCls} value={form.salary_max ?? ''} onChange={e => set({ salary_max: Number(e.target.value) })} />
                </Field>
                <Field label="Period">
                  <select className={inputCls} value={form.salary_period ?? 'monthly'} onChange={e => set({ salary_period: e.target.value })}>
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input className={inputCls} value={form.location_city ?? ''} onChange={e => set({ location_city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input className={inputCls} value={form.location_state ?? ''} onChange={e => set({ location_state: e.target.value })} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Job type">
                  <select className={inputCls} value={form.job_type ?? 'full_time'} onChange={e => set({ job_type: e.target.value })}>
                    <option value="full_time">Full time</option>
                    <option value="part_time">Part time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select className={inputCls} value={form.status ?? 'open'} onChange={e => set({ status: e.target.value })}>
                    <option value="open">Open</option>
                    <option value="on_hold">On hold</option>
                    <option value="filled">Filled</option>
                    <option value="closed">Closed</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Exp. min (yrs)">
                  <input type="number" step="0.5" className={inputCls} value={form.experience_min_years ?? ''} onChange={e => set({ experience_min_years: Number(e.target.value) })} />
                </Field>
                <Field label="Exp. max (yrs)">
                  <input type="number" step="0.5" className={inputCls} value={form.experience_max_years ?? ''} onChange={e => set({ experience_max_years: Number(e.target.value) })} />
                </Field>
                <Field label="Closes on">
                  <input type="date" className={inputCls} value={form.closes_on ?? ''} onChange={e => set({ closes_on: e.target.value })} />
                </Field>
              </div>

              <Field label="Qualification">
                <input className={inputCls} value={form.qualification ?? ''} onChange={e => set({ qualification: e.target.value })} placeholder="12th pass, Graduate…" />
              </Field>

              <Field label="Description">
                <textarea rows={3} className={inputCls} value={form.description ?? ''} onChange={e => set({ description: e.target.value })} />
              </Field>

              {/* deal */}
              <div className="rounded-xl border border-gray-200 p-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideDeal}
                    onChange={e => setOverrideDeal(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">Different commission for this job</span>
                </label>

                {!overrideDeal ? (
                  <p className="text-xs text-gray-500">
                    Using the company deal:{' '}
                    <b className="text-gray-800">
                      {effectiveTerms ? describeTerms(effectiveTerms) : '—'}
                    </b>
                  </p>
                ) : (
                  <div className="space-y-3">
                    <Field label="How we charge">
                      <select className={inputCls} value={form.commission_type ?? 'percent_of_salary'} onChange={e => set({ commission_type: e.target.value })}>
                        <option value="percent_of_salary">Percentage of salary</option>
                        <option value="fixed_per_hire">Fixed amount per hire</option>
                      </select>
                    </Field>
                    {form.commission_type === 'fixed_per_hire' ? (
                      <Field label="Amount per hire (₹)">
                        <input type="number" className={inputCls} value={form.commission_fixed_amount ?? ''} onChange={e => set({ commission_fixed_amount: Number(e.target.value) })} />
                      </Field>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Percentage (%)">
                          <input type="number" step="0.01" className={inputCls} value={form.commission_percent ?? ''} onChange={e => set({ commission_percent: Number(e.target.value) })} />
                        </Field>
                        <Field label="Taken from">
                          <select className={inputCls} value={form.commission_base ?? 'first_month'} onChange={e => set({ commission_base: e.target.value })}>
                            <option value="first_month">First month salary</option>
                            <option value="monthly">Every month&apos;s salary</option>
                            <option value="annual">Annual CTC</option>
                          </select>
                        </Field>
                      </div>
                    )}
                    {form.commission_type !== 'fixed_per_hire' && form.commission_base === 'monthly' && (
                      <Field label="For how many months">
                        <input type="number" min={1} className={inputCls} value={form.commission_months ?? 1} onChange={e => set({ commission_months: Number(e.target.value) })} />
                      </Field>
                    )}
                    {effectiveTerms && (
                      <p className="text-xs text-emerald-700 font-medium">{describeTerms(effectiveTerms)}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4 flex gap-3">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Post job'}
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

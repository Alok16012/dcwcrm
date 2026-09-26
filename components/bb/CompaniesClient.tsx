'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Building2, Plus, Pencil, Search, X, Info } from 'lucide-react'
import { bbClient } from '@/lib/bb/db'
import { inr } from '@/lib/bb/constants'
import { resolveTerms, buildSchedule, scheduleTotal, describeTerms } from '@/lib/bb/commission'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Company {
  id: string
  name: string
  industry: string | null
  city: string | null
  state: string | null
  contact_person: string | null
  contact_phone: string | null
  contact_email: string | null
  status: string
  commission_type: string
  commission_percent: number | null
  commission_base: string | null
  commission_months: number | null
  commission_fixed_amount: number | null
  payment_terms_days: number
  guarantee_days: number
  notes: string | null
  open_jobs?: number
  placements?: number
}

const EMPTY: Partial<Company> = {
  name: '', industry: '', city: '', state: '',
  contact_person: '', contact_phone: '', contact_email: '',
  status: 'active',
  commission_type: 'percent_of_salary',
  commission_percent: 8.33,
  commission_base: 'first_month',
  commission_months: 1,
  commission_fixed_amount: null,
  payment_terms_days: 30,
  guarantee_days: 90,
  notes: '',
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  blacklisted: 'bg-red-100 text-red-700',
}

/** A salary used only to show what a deal would earn, so terms feel concrete. */
const PREVIEW_SALARY = 25000

export default function CompaniesClient({
  companies, canEdit,
}: { companies: Company[]; canEdit: boolean }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Company>>(EMPTY)

  const filtered = companies.filter(c => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [c.name, c.industry, c.city, c.contact_person, c.contact_phone]
      .some(v => v?.toLowerCase().includes(q))
  })

  function edit(c: Company) {
    setForm({ ...c })
    setOpen(true)
  }

  function create() {
    setForm({ ...EMPTY })
    setOpen(true)
  }

  const set = (patch: Partial<Company>) => setForm(f => ({ ...f, ...patch }))

  async function save() {
    if (!form.name?.trim()) {
      toast.error('Company name is required')
      return
    }
    setSaving(true)
    try {
      const db = bbClient()
      const payload = {
        name: form.name.trim(),
        industry: form.industry || null,
        city: form.city || null,
        state: form.state || null,
        contact_person: form.contact_person || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        status: form.status ?? 'active',
        commission_type: form.commission_type ?? 'percent_of_salary',
        commission_percent:
          form.commission_type === 'fixed_per_hire' ? null : Number(form.commission_percent ?? 0),
        commission_base:
          form.commission_type === 'fixed_per_hire' ? null : (form.commission_base ?? 'first_month'),
        commission_months:
          form.commission_base === 'monthly' ? Number(form.commission_months ?? 1) : 1,
        commission_fixed_amount:
          form.commission_type === 'fixed_per_hire' ? Number(form.commission_fixed_amount ?? 0) : null,
        payment_terms_days: Number(form.payment_terms_days ?? 30),
        guarantee_days: Number(form.guarantee_days ?? 90),
        notes: form.notes || null,
      }

      const { error } = form.id
        ? await db.from('bb_companies').update(payload).eq('id', form.id)
        : await db.from('bb_companies').insert(payload)

      if (error) throw new Error(error.message)

      toast.success(form.id ? 'Company updated' : 'Company added')
      setOpen(false)
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  // Live read-back of the deal being typed, priced against a sample salary —
  // percentages are easy to mis-enter and hard to notice later.
  const previewTerms = resolveTerms(form as any)
  const previewSchedule = buildSchedule(previewTerms, {
    offeredSalary: PREVIEW_SALARY,
    salaryPeriod: 'monthly',
    joinedOn: new Date().toISOString().slice(0, 10),
    paymentTermsDays: Number(form.payment_terms_days ?? 30),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, city, contact…"
            className="w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>
        {canEdit && (
          <button
            onClick={create}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" /> Add company
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Building2 className="w-7 h-7 mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-700">
            {companies.length === 0 ? 'No companies yet' : 'No match'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {companies.length === 0
              ? 'Add the employers you recruit for. Their commission deal lives here.'
              : 'Try a different search.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(c => {
            const terms = resolveTerms(c as any)
            return (
              <div key={c.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{c.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {[c.industry, [c.city, c.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[c.status] ?? STATUS_STYLE.inactive}`}>
                    {c.status}
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70">Deal</p>
                  <p className="text-sm font-semibold text-emerald-900 mt-0.5">{describeTerms(terms)}</p>
                  <p className="text-[11px] text-emerald-700/70 mt-1">
                    Pay in {c.payment_terms_days}d · {c.guarantee_days}d replacement guarantee
                  </p>
                </div>

                {(c.contact_person || c.contact_phone) && (
                  <p className="text-xs text-gray-500 mt-3">
                    {c.contact_person}
                    {c.contact_person && c.contact_phone ? ' · ' : ''}
                    {c.contact_phone}
                  </p>
                )}

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <div className="flex gap-4 text-xs">
                    <span className="text-gray-500">
                      <b className="text-gray-900">{c.open_jobs ?? 0}</b> open jobs
                    </span>
                    <span className="text-gray-500">
                      <b className="text-gray-900">{c.placements ?? 0}</b> placed
                    </span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => edit(c)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-emerald-700"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---------------------------------------------------- form panel --- */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative ml-auto w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{form.id ? 'Edit company' : 'Add company'}</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <Section title="Company">
                <Field label="Name" required>
                  <input className={inputCls} value={form.name ?? ''} onChange={e => set({ name: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Industry">
                    <input className={inputCls} value={form.industry ?? ''} onChange={e => set({ industry: e.target.value })} placeholder="IT, Retail…" />
                  </Field>
                  <Field label="Status">
                    <select className={inputCls} value={form.status ?? 'active'} onChange={e => set({ status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="blacklisted">Blacklisted</option>
                    </select>
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
              </Section>

              <Section title="Contact">
                <Field label="Person">
                  <input className={inputCls} value={form.contact_person ?? ''} onChange={e => set({ contact_person: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone">
                    <input className={inputCls} value={form.contact_phone ?? ''} onChange={e => set({ contact_phone: e.target.value })} />
                  </Field>
                  <Field label="Email">
                    <input className={inputCls} value={form.contact_email ?? ''} onChange={e => set({ contact_email: e.target.value })} />
                  </Field>
                </div>
              </Section>

              <Section title="Commission deal">
                <Field label="How we charge">
                  <select
                    className={inputCls}
                    value={form.commission_type ?? 'percent_of_salary'}
                    onChange={e => set({ commission_type: e.target.value })}
                  >
                    <option value="percent_of_salary">Percentage of salary</option>
                    <option value="fixed_per_hire">Fixed amount per hire</option>
                  </select>
                </Field>

                {form.commission_type === 'fixed_per_hire' ? (
                  <Field label="Amount per hire (₹)">
                    <input
                      type="number"
                      className={inputCls}
                      value={form.commission_fixed_amount ?? ''}
                      onChange={e => set({ commission_fixed_amount: Number(e.target.value) })}
                    />
                  </Field>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Percentage (%)">
                        <input
                          type="number" step="0.01"
                          className={inputCls}
                          value={form.commission_percent ?? ''}
                          onChange={e => set({ commission_percent: Number(e.target.value) })}
                        />
                      </Field>
                      <Field label="Taken from">
                        <select
                          className={inputCls}
                          value={form.commission_base ?? 'first_month'}
                          onChange={e => set({ commission_base: e.target.value })}
                        >
                          <option value="first_month">First month salary</option>
                          <option value="monthly">Every month&apos;s salary</option>
                          <option value="annual">Annual CTC</option>
                        </select>
                      </Field>
                    </div>

                    {form.commission_base === 'monthly' && (
                      <Field label="For how many months">
                        <input
                          type="number" min={1}
                          className={inputCls}
                          value={form.commission_months ?? 1}
                          onChange={e => set({ commission_months: Number(e.target.value) })}
                        />
                      </Field>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Payment terms (days)">
                    <input
                      type="number"
                      className={inputCls}
                      value={form.payment_terms_days ?? 30}
                      onChange={e => set({ payment_terms_days: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Replacement guarantee (days)">
                    <input
                      type="number"
                      className={inputCls}
                      value={form.guarantee_days ?? 90}
                      onChange={e => set({ guarantee_days: Number(e.target.value) })}
                    />
                  </Field>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <Info className="w-3.5 h-3.5" /> What this means
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-1.5">{describeTerms(previewTerms)}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    On a {inr(PREVIEW_SALARY)}/month hire that is{' '}
                    <b className="text-emerald-700">{inr(scheduleTotal(previewSchedule))}</b> total
                    {previewSchedule.length > 1 ? ` across ${previewSchedule.length} invoices` : ' in one invoice'}.
                  </p>
                </div>
              </Section>

              <Field label="Notes">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={form.notes ?? ''}
                  onChange={e => set({ notes: e.target.value })}
                />
              </Field>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4 flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add company'}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{title}</p>
      {children}
    </div>
  )
}

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

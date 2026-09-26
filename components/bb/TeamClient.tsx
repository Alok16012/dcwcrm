'use client'
import { withBase } from '@/lib/base-path'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { Users2, Plus, Pencil, X, KeyRound, Copy, Check, ShieldCheck } from 'lucide-react'
import { inr, BB_ROLE_LABELS, BB_ROLES, type BbRole } from '@/lib/bb/constants'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TeamMember {
  profile_id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  is_active: boolean
  employee_id: string | null
  employee_code: string | null
  designation: string | null
  department: string | null
  joining_date: string | null
  basic_salary: number
  hra: number
  allowances: number
  pf_deduction: number
  tds_deduction: number
  other_deductions: number
  incentive_per_placement: number
  incentive_percent_of_commission: number
  bank_account: string | null
  bank_ifsc: string | null
  bank_name: string | null
  salary_cycle_start_day: number
  placements: number
}

const EMPTY = {
  full_name: '', email: '', phone: '', role: 'bb_telecaller' as string,
  employee_code: '', designation: '', department: '', joining_date: '',
  basic_salary: 0, hra: 0, allowances: 0,
  pf_deduction: 0, tds_deduction: 0, other_deductions: 0,
  incentive_per_placement: 0, incentive_percent_of_commission: 0,
  bank_account: '', bank_ifsc: '', bank_name: '',
  salary_cycle_start_day: 1,
  password: '',
}

export default function TeamClient({ members }: { members: TeamMember[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [issued, setIssued] = useState<{ name: string; email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const set = (patch: Record<string, unknown>) => setForm((f: any) => ({ ...f, ...patch }))

  function create() {
    setEditing(null)
    setForm({ ...EMPTY })
    setOpen(true)
  }

  function edit(m: TeamMember) {
    setEditing(m)
    setForm({
      full_name: m.full_name, email: m.email, phone: m.phone ?? '', role: m.role,
      employee_code: m.employee_code ?? '', designation: m.designation ?? '',
      department: m.department ?? '', joining_date: m.joining_date ?? '',
      basic_salary: m.basic_salary, hra: m.hra, allowances: m.allowances,
      pf_deduction: m.pf_deduction, tds_deduction: m.tds_deduction,
      other_deductions: m.other_deductions,
      incentive_per_placement: m.incentive_per_placement,
      incentive_percent_of_commission: m.incentive_percent_of_commission,
      bank_account: m.bank_account ?? '', bank_ifsc: m.bank_ifsc ?? '',
      bank_name: m.bank_name ?? '', salary_cycle_start_day: m.salary_cycle_start_day,
      password: '',
    })
    setOpen(true)
  }

  async function save() {
    if (!form.full_name?.trim()) { toast.error('Name is required'); return }
    if (!editing && !form.email?.trim()) { toast.error('Email is required'); return }

    setSaving(true)
    try {
      const res = await fetch(withBase('/api/bb/team'), {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editing ? { profile_id: editing.profile_id, ...form } : form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save')

      if (!editing && json.password) {
        setIssued({ name: form.full_name, email: form.email, password: json.password })
      } else {
        toast.success(editing ? 'Saved' : 'Staff account created')
      }
      setOpen(false)
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(m: TeamMember) {
    try {
      const res = await fetch(withBase('/api/bb/team'), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile_id: m.profile_id, is_active: !m.is_active }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not update')
      toast.success(m.is_active ? 'Account disabled' : 'Account enabled')
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update')
    }
  }

  async function resetPassword(m: TeamMember) {
    try {
      const res = await fetch(withBase('/api/bb/team/password'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile_id: m.profile_id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not reset')
      setIssued({ name: m.full_name, email: m.email, password: json.password })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reset')
    }
  }

  function monthlyCost(m: TeamMember): number {
    return Number(m.basic_salary) + Number(m.hra) + Number(m.allowances)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={create}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" /> Add staff
        </button>
      </div>

      {members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Users2 className="w-7 h-7 mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-700">No staff yet</p>
          <p className="text-sm text-gray-500 mt-1">Add telecallers and managers here — they sign in on the same page and pick Berojgar Bharat.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Role</th>
                  <th className="px-4 py-2.5 font-semibold">Joined</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Monthly</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Incentive</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Placed</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map(m => (
                  <tr key={m.profile_id} className={`hover:bg-gray-50 ${m.is_active ? '' : 'opacity-50'}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{m.full_name}</p>
                      <p className="text-xs text-gray-500">{m.email}</p>
                      <p className="text-[11px] text-gray-400">{m.employee_code} · {m.designation || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                        {BB_ROLE_LABELS[m.role as BbRole] ?? m.role}
                      </span>
                      {!m.is_active && (
                        <span className="ml-1 text-[11px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-700">
                          disabled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {m.joining_date ? format(parseISO(m.joining_date), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                      {inr(monthlyCost(m))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-600">
                      {m.incentive_per_placement > 0 && <div>{inr(m.incentive_per_placement)}/placement</div>}
                      {m.incentive_percent_of_commission > 0 && <div>{m.incentive_percent_of_commission}% of commission</div>}
                      {m.incentive_per_placement === 0 && m.incentive_percent_of_commission === 0 && '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 font-semibold">{m.placements}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => edit(m)} title="Edit"
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-emerald-700 hover:border-emerald-300">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => resetPassword(m)} title="Reset password"
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-amber-700 hover:border-amber-300">
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => toggleActive(m)} title={m.is_active ? 'Disable' : 'Enable'}
                          className={`p-1.5 rounded-lg border ${m.is_active ? 'border-gray-200 text-gray-500 hover:text-red-700 hover:border-red-300' : 'border-green-300 text-green-700'}`}>
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------- password handover --- */}
      {issued && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <h2 className="font-bold text-gray-900">Password for {issued.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Shown once. Copy it now — it is not stored anywhere.
            </p>

            <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Email</p>
                <p className="text-sm font-mono text-gray-900">{issued.email}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Password</p>
                <p className="text-sm font-mono font-bold text-gray-900 break-all">{issued.password}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(`${issued.email}\n${issued.password}`)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => { setIssued(null); setCopied(false) }}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Done
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
              <h2 className="font-bold text-gray-900">{editing ? 'Edit staff' : 'Add staff'}</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <Section title="Account">
                <Field label="Full name" required>
                  <input className={inputCls} value={form.full_name} onChange={e => set({ full_name: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email" required>
                    <input
                      className={inputCls}
                      value={form.email}
                      disabled={!!editing}
                      onChange={e => set({ email: e.target.value })}
                    />
                  </Field>
                  <Field label="Phone">
                    <input className={inputCls} value={form.phone} onChange={e => set({ phone: e.target.value })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Role">
                    <select className={inputCls} value={form.role} onChange={e => set({ role: e.target.value })}>
                      {BB_ROLES.map(r => (
                        <option key={r} value={r}>{BB_ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Employee code">
                    <input className={inputCls} value={form.employee_code} onChange={e => set({ employee_code: e.target.value })} placeholder="auto" />
                  </Field>
                </div>
                {!editing && (
                  <Field label="Password (blank = generate a strong one)">
                    <input className={inputCls} value={form.password} onChange={e => set({ password: e.target.value })} />
                  </Field>
                )}
              </Section>

              <Section title="Role details">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Designation">
                    <input className={inputCls} value={form.designation} onChange={e => set({ designation: e.target.value })} />
                  </Field>
                  <Field label="Department">
                    <input className={inputCls} value={form.department} onChange={e => set({ department: e.target.value })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Joining date">
                    <input type="date" className={inputCls} value={form.joining_date} onChange={e => set({ joining_date: e.target.value })} />
                  </Field>
                  <Field label="Salary cycle starts on">
                    <input type="number" min={1} max={28} className={inputCls} value={form.salary_cycle_start_day} onChange={e => set({ salary_cycle_start_day: Number(e.target.value) })} />
                  </Field>
                </div>
              </Section>

              <Section title="Salary">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Basic"><input type="number" className={inputCls} value={form.basic_salary} onChange={e => set({ basic_salary: Number(e.target.value) })} /></Field>
                  <Field label="HRA"><input type="number" className={inputCls} value={form.hra} onChange={e => set({ hra: Number(e.target.value) })} /></Field>
                  <Field label="Allowances"><input type="number" className={inputCls} value={form.allowances} onChange={e => set({ allowances: Number(e.target.value) })} /></Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="PF"><input type="number" className={inputCls} value={form.pf_deduction} onChange={e => set({ pf_deduction: Number(e.target.value) })} /></Field>
                  <Field label="TDS"><input type="number" className={inputCls} value={form.tds_deduction} onChange={e => set({ tds_deduction: Number(e.target.value) })} /></Field>
                  <Field label="Other ded."><input type="number" className={inputCls} value={form.other_deductions} onChange={e => set({ other_deductions: Number(e.target.value) })} /></Field>
                </div>
                <p className="text-xs text-gray-500">
                  Monthly gross{' '}
                  <b className="text-gray-800">
                    {inr(Number(form.basic_salary) + Number(form.hra) + Number(form.allowances))}
                  </b>
                </p>
              </Section>

              <Section title="Placement incentive">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Flat per placement (₹)">
                    <input type="number" className={inputCls} value={form.incentive_per_placement} onChange={e => set({ incentive_per_placement: Number(e.target.value) })} />
                  </Field>
                  <Field label="% of commission earned">
                    <input type="number" step="0.01" className={inputCls} value={form.incentive_percent_of_commission} onChange={e => set({ incentive_percent_of_commission: Number(e.target.value) })} />
                  </Field>
                </div>
                <p className="text-xs text-gray-500">
                  Both can be set — payroll adds them together for every placement credited to this
                  person in the cycle.
                </p>
              </Section>

              <Section title="Bank">
                <Field label="Account number">
                  <input className={inputCls} value={form.bank_account} onChange={e => set({ bank_account: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="IFSC"><input className={inputCls} value={form.bank_ifsc} onChange={e => set({ bank_ifsc: e.target.value })} /></Field>
                  <Field label="Bank"><input className={inputCls} value={form.bank_name} onChange={e => set({ bank_name: e.target.value })} /></Field>
                </div>
              </Section>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4 flex gap-3">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:bg-gray-100 disabled:text-gray-500'

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

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ClipboardCheck, CheckCircle2, XCircle, Plus, Clock, Loader2, ShieldCheck, History, Trash2 } from 'lucide-react'

interface Request {
  id: string; employee_id: string; employee_name: string; work_date: string
  punch_type: string; requested_in: string | null; requested_out: string | null
  reason: string; status: string; rejection_reason: string | null; created_at: string
}
interface Permission {
  id: string; employee_id: string; employee_name: string
  work_date: string; allowed_till: string; reason: string | null
}
interface AuditRow {
  id: string; entity: string; action: string; reason: string | null
  changed_by_name: string | null; created_at: string
}

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const hhmm = (t: string | null) => t ? String(t).slice(0, 5) : '—'
const inputCls = 'w-full border border-gray-200 rounded-lg px-3 h-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function RegularizationClient({ requests, permissions, auditLog, employees }: {
  requests: Request[]; permissions: Permission[]; auditLog: AuditRow[]; employees: { id: string; name: string }[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const db = supabase as any

  const [tab, setTab] = useState<'requests' | 'permissions' | 'audit'>('requests')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [permOpen, setPermOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ employee_id: '', work_date: '', punch_type: 'both', requested_in: '', requested_out: '', reason: '' })
  const [perm, setPerm] = useState({ employee_id: '', work_date: '', allowed_till: '11:00', reason: '' })

  const pending = requests.filter(r => r.status === 'pending')

  async function decide(id: string, action: 'approve' | 'reject') {
    const reason = action === 'reject' ? window.prompt('Reject kyun? (optional)') ?? '' : ''
    setBusyId(id)
    try {
      const res = await fetch('/api/hrms/regularization/decision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed'); return }
      toast.success(action === 'approve' ? `Approved — attendance ab ${json.attendance}` : 'Request rejected')
      router.refresh()
    } finally { setBusyId(null) }
  }

  async function addRequest() {
    if (!form.employee_id || !form.work_date || !form.reason.trim()) { toast.error('Employee, date aur reason zaroori hai'); return }
    if (form.punch_type !== 'out' && !form.requested_in) { toast.error('Punch in time daalo'); return }
    if (form.punch_type !== 'in' && !form.requested_out) { toast.error('Punch out time daalo'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await db.from('attendance_regularizations').insert({
      employee_id: form.employee_id,
      work_date: form.work_date,
      punch_type: form.punch_type,
      requested_in: form.punch_type === 'out' ? null : form.requested_in,
      requested_out: form.punch_type === 'in' ? null : form.requested_out,
      reason: form.reason.trim(),
      applied_by: user?.id ?? null,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Regularization request added')
    setForm({ employee_id: '', work_date: '', punch_type: 'both', requested_in: '', requested_out: '', reason: '' })
    setAddOpen(false)
    router.refresh()
  }

  async function addPermission() {
    if (!perm.employee_id || !perm.work_date || !perm.allowed_till) { toast.error('Employee, date aur time zaroori hai'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await db.from('special_late_permissions').upsert({
      employee_id: perm.employee_id, work_date: perm.work_date,
      allowed_till: perm.allowed_till, reason: perm.reason.trim() || null, created_by: user?.id ?? null,
    }, { onConflict: 'employee_id,work_date' })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Late permission added — sirf us date ke liye')
    setPerm({ employee_id: '', work_date: '', allowed_till: '11:00', reason: '' })
    setPermOpen(false)
    router.refresh()
  }

  async function removePermission(p: Permission) {
    if (!window.confirm(`Remove late permission?\n\n${p.employee_name} — ${fmtDate(p.work_date)}`)) return
    setBusyId(p.id)
    const { error } = await db.from('special_late_permissions').delete().eq('id', p.id)
    setBusyId(null)
    if (error) { toast.error(error.message); return }
    toast.success('Removed')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Regularization</h1>
          <p className="text-sm text-muted-foreground">
            Missing or wrong punches get corrected here — biometric data itself is never edited
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPermOpen(true)} className="gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Late Permission
          </Button>
          <Button onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Request
          </Button>
        </div>
      </div>

      <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl w-fit">
        {([
          ['requests', `Requests${pending.length ? ` (${pending.length})` : ''}`],
          ['permissions', 'Late Permissions'],
          ['audit', 'Audit Log'],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === k ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        requests.length === 0 ? <Empty icon={ClipboardCheck} text="No regularization requests" /> : (
          <div className="space-y-2">
            {requests.map(r => (
              <div key={r.id} className="bg-white border rounded-xl p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-48">
                  <p className="font-semibold text-sm text-gray-900">{r.employee_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {fmtDate(r.work_date)} · {r.punch_type === 'both' ? 'In & Out' : r.punch_type === 'in' ? 'Punch In' : 'Punch Out'}
                    {' · '}{hhmm(r.requested_in)} → {hhmm(r.requested_out)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>
                  {r.rejection_reason && <p className="text-xs text-red-600 mt-0.5">Rejected: {r.rejection_reason}</p>}
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${STATUS_CLS[r.status] ?? STATUS_CLS.pending}`}>
                  {r.status}
                </span>
                {r.status === 'pending' && (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" className="h-8 gap-1.5 bg-green-600 hover:bg-green-700"
                      disabled={busyId === r.id} onClick={() => decide(r.id, 'approve')}>
                      {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={busyId === r.id} onClick={() => decide(r.id, 'reject')}>
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'permissions' && (
        permissions.length === 0 ? <Empty icon={ShieldCheck} text="No special late permissions" /> : (
          <div className="space-y-2">
            {permissions.map(p => (
              <div key={p.id} className="bg-white border rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{p.employee_name}</p>
                  <p className="text-xs text-gray-500">
                    {fmtDate(p.work_date)} · allowed till <b>{hhmm(p.allowed_till)}</b>
                    {p.reason ? ` · ${p.reason}` : ''}
                  </p>
                </div>
                <button onClick={() => removePermission(p)} disabled={busyId === p.id}
                  title="Remove" className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'audit' && (
        auditLog.length === 0 ? <Empty icon={History} text="Nothing logged yet" /> : (
          <div className="rounded-xl border overflow-hidden bg-white divide-y">
            {auditLog.map(a => (
              <div key={a.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                  {a.entity}
                </span>
                <span className="font-medium text-gray-800">{a.action}</span>
                {a.reason && <span className="text-xs text-gray-400 truncate">· {a.reason}</span>}
                <span className="ml-auto text-xs text-gray-400 shrink-0">
                  {a.changed_by_name ?? '—'} · {new Date(a.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )
      )}

      {/* Add regularization request */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-blue-600" /> Add Regularization</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1">
            <Field label="Employee *">
              <select className={inputCls} value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
                <option value="">Select employee…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date *"><input type="date" className={inputCls} value={form.work_date} onChange={e => setForm(p => ({ ...p, work_date: e.target.value }))} /></Field>
              <Field label="Punch Type *">
                <select className={inputCls} value={form.punch_type} onChange={e => setForm(p => ({ ...p, punch_type: e.target.value }))}>
                  <option value="both">In & Out</option><option value="in">Punch In</option><option value="out">Punch Out</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {form.punch_type !== 'out' && (
                <Field label="Punch In *"><input type="time" className={inputCls} value={form.requested_in} onChange={e => setForm(p => ({ ...p, requested_in: e.target.value }))} /></Field>
              )}
              {form.punch_type !== 'in' && (
                <Field label="Punch Out *"><input type="time" className={inputCls} value={form.requested_out} onChange={e => setForm(p => ({ ...p, requested_out: e.target.value }))} /></Field>
              )}
            </div>
            <Field label="Reason *"><Textarea rows={2} className="resize-y" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} /></Field>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={addRequest} disabled={saving} className="min-w-28">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Special late permission */}
      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Clock className="w-4 h-4 text-violet-600" /> Special Late Permission</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1">
            <p className="text-xs text-gray-500">Sirf chuni hui date ke liye — permanent grace nahi banta.</p>
            <Field label="Employee *">
              <select className={inputCls} value={perm.employee_id} onChange={e => setPerm(p => ({ ...p, employee_id: e.target.value }))}>
                <option value="">Select employee…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date *"><input type="date" className={inputCls} value={perm.work_date} onChange={e => setPerm(p => ({ ...p, work_date: e.target.value }))} /></Field>
              <Field label="Allowed Till *"><input type="time" className={inputCls} value={perm.allowed_till} onChange={e => setPerm(p => ({ ...p, allowed_till: e.target.value }))} /></Field>
            </div>
            <Field label="Reason"><Textarea rows={2} className="resize-y" value={perm.reason} onChange={e => setPerm(p => ({ ...p, reason: e.target.value }))} /></Field>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setPermOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={addPermission} disabled={saving} className="min-w-28">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Give Permission'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold text-gray-600">{label}</Label>{children}</div>
}

function Empty({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-14 border rounded-2xl bg-white">
      <Icon className="w-9 h-9 mx-auto mb-3 text-gray-200" />
      <p className="font-semibold text-gray-500 text-sm">{text}</p>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  CalendarDays, CheckCircle2, XCircle, Clock, Plus, Trash2, Eye, EyeOff, Loader2, CalendarPlus,
} from 'lucide-react'

interface LeaveBalance { opening: number; credit: number; used: number; available: number }
interface BalanceRow {
  employee_id: string; name: string; employee_code: string | null
  joining_date: string | null; cl: LeaveBalance; sl: LeaveBalance; lwpDays: number
}
interface RequestRow {
  id: string; employee_id: string; employee_name: string; leave_type: string
  from_date: string; to_date: string; days: number | null; reason: string | null
  status: string; rejection_reason: string | null; created_at: string
}
interface Holiday { id: string; holiday_date: string; name: string; is_active: boolean }

const TYPE_LABEL: Record<string, string> = {
  casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave',
  unpaid: 'Leave Without Pay', lwp: 'Leave Without Pay', other: 'Other',
}
const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const inputCls = 'w-full border border-gray-200 rounded-lg px-3 h-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function LeaveClient({ requests, balances, holidays, employees, monthLabel }: {
  requests: RequestRow[]; balances: BalanceRow[]; holidays: Holiday[]
  employees: { id: string; name: string }[]; monthLabel: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const db = supabase as any

  const [tab, setTab] = useState<'requests' | 'balances' | 'holidays'>('requests')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)
  const [form, setForm] = useState({ employee_id: '', leave_type: 'casual', from_date: '', to_date: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [holidayForm, setHolidayForm] = useState({ holiday_date: '', name: '' })

  const pending = requests.filter(r => r.status === 'pending')

  async function decide(id: string, action: 'approve' | 'reject') {
    const reason = action === 'reject' ? window.prompt('Reject kyun kar rahe ho? (optional)') ?? '' : ''
    setBusyId(id)
    try {
      const res = await fetch('/api/hrms/leave/decision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed'); return }
      toast.success(action === 'approve'
        ? `Approved — ${json.paidDays} paid${json.lwpDays ? `, ${json.lwpDays} LWP` : ''}`
        : 'Leave rejected')
      router.refresh()
    } finally { setBusyId(null) }
  }

  async function applyLeave() {
    if (!form.employee_id || !form.from_date || !form.to_date) { toast.error('Employee aur dono dates chahiye'); return }
    if (form.to_date < form.from_date) { toast.error('"To" date "From" se pehle nahi ho sakti'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await db.from('leave_requests').insert({
      employee_id: form.employee_id,
      leave_type: form.leave_type,
      from_date: form.from_date,
      to_date: form.to_date,
      reason: form.reason.trim() || null,
      status: 'pending',
      applied_by: user?.id ?? null,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Leave request added')
    setForm({ employee_id: '', leave_type: 'casual', from_date: '', to_date: '', reason: '' })
    setApplyOpen(false)
    router.refresh()
  }

  async function addHoliday() {
    if (!holidayForm.holiday_date || !holidayForm.name.trim()) { toast.error('Date aur naam dono chahiye'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await db.from('holidays').insert({
      holiday_date: holidayForm.holiday_date, name: holidayForm.name.trim(), created_by: user?.id ?? null,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Holiday added')
    setHolidayForm({ holiday_date: '', name: '' })
    router.refresh()
  }

  async function toggleHoliday(h: Holiday) {
    setBusyId(h.id)
    const { error } = await db.from('holidays').update({ is_active: !h.is_active }).eq('id', h.id)
    setBusyId(null)
    if (error) { toast.error(error.message); return }
    router.refresh()
  }

  async function removeHoliday(h: Holiday) {
    if (!window.confirm(`Delete holiday?\n\n${h.name} — ${fmtDate(h.holiday_date)}`)) return
    setBusyId(h.id)
    const { error } = await db.from('holidays').delete().eq('id', h.id)
    setBusyId(null)
    if (error) { toast.error(error.message); return }
    toast.success('Deleted')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Leave & Holidays</h1>
          <p className="text-sm text-muted-foreground">
            Balances as at {monthLabel} · approved leave writes straight to attendance
          </p>
        </div>
        <Button onClick={() => setApplyOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Leave Request
        </Button>
      </div>

      <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl w-fit">
        {([
          ['requests', `Requests${pending.length ? ` (${pending.length})` : ''}`],
          ['balances', 'Balances'],
          ['holidays', 'Holidays'],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === k ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <div className="space-y-2">
          {requests.length === 0 ? (
            <Empty icon={CalendarDays} text="No leave requests yet" />
          ) : requests.map(r => (
            <div key={r.id} className="bg-white border rounded-xl p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-48">
                <p className="font-semibold text-sm text-gray-900">{r.employee_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {TYPE_LABEL[r.leave_type] ?? r.leave_type} · {fmtDate(r.from_date)}
                  {r.to_date !== r.from_date && ` → ${fmtDate(r.to_date)}`}
                  {r.days ? ` · ${r.days} day${r.days > 1 ? 's' : ''}` : ''}
                </p>
                {r.reason && <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>}
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
      )}

      {tab === 'balances' && (
        <div className="rounded-xl border overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b text-xs text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Employee</th>
                  <th className="text-center px-3 py-2.5 font-semibold" colSpan={3}>Casual Leave</th>
                  <th className="text-center px-3 py-2.5 font-semibold border-l" colSpan={3}>Sick Leave</th>
                  <th className="text-center px-3 py-2.5 font-semibold border-l">LWP</th>
                </tr>
                <tr className="text-[10px] uppercase text-slate-400">
                  <th className="px-4 pb-2"></th>
                  <th className="px-3 pb-2">Opening</th><th className="px-3 pb-2">Used</th><th className="px-3 pb-2">Available</th>
                  <th className="px-3 pb-2 border-l">Opening</th><th className="px-3 pb-2">Used</th><th className="px-3 pb-2">Available</th>
                  <th className="px-3 pb-2 border-l">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {balances.map(b => (
                  <tr key={b.employee_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{b.name}</p>
                      <p className="text-[11px] text-gray-400">{b.employee_code ?? '—'}</p>
                    </td>
                    <Bal v={b.cl.opening} /><Bal v={b.cl.used} /><Bal v={b.cl.available} strong />
                    <Bal v={b.sl.opening} border /><Bal v={b.sl.used} /><Bal v={b.sl.available} strong />
                    <Bal v={b.lwpDays} border />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 border-t bg-slate-50 text-[11px] text-slate-500">
            Opening = carried forward from earlier months · credit is added every month from HRMS Settings
          </p>
        </div>
      )}

      {tab === 'holidays' && (
        <div className="space-y-3">
          <div className="bg-white border rounded-xl p-3 flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Date</Label>
              <input type="date" value={holidayForm.holiday_date} className={inputCls}
                onChange={e => setHolidayForm(p => ({ ...p, holiday_date: e.target.value }))} />
            </div>
            <div className="space-y-1 flex-1 min-w-48">
              <Label className="text-xs font-semibold text-slate-600">Holiday Name</Label>
              <Input placeholder="e.g. Diwali" value={holidayForm.name}
                onChange={e => setHolidayForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <Button onClick={addHoliday} className="gap-1.5 h-10"><CalendarPlus className="w-4 h-4" /> Add Holiday</Button>
          </div>

          {holidays.length === 0 ? (
            <Empty icon={CalendarDays} text="No holidays added yet" />
          ) : (
            <div className="space-y-2">
              {holidays.map(h => (
                <div key={h.id} className={`bg-white border rounded-xl p-3 flex items-center gap-3 ${h.is_active ? '' : 'opacity-60'}`}>
                  <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{h.name}</p>
                    <p className="text-xs text-gray-500">{fmtDate(h.holiday_date)}{h.is_active ? '' : ' · hidden'}</p>
                  </div>
                  <button onClick={() => toggleHoliday(h)} disabled={busyId === h.id}
                    title={h.is_active ? 'Hide' : 'Show'} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                    {h.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => removeHoliday(h)} disabled={busyId === h.id}
                    title="Delete" className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> Add Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Employee *</Label>
              <select className={inputCls} value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
                <option value="">Select employee…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Leave Type *</Label>
              <select className={inputCls} value={form.leave_type} onChange={e => setForm(p => ({ ...p, leave_type: e.target.value }))}>
                <option value="casual">Casual Leave (CL)</option>
                <option value="sick">Sick Leave (SL)</option>
                <option value="lwp">Leave Without Pay (LWP)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">From *</Label>
                <input type="date" className={inputCls} value={form.from_date} onChange={e => setForm(p => ({ ...p, from_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">To *</Label>
                <input type="date" className={inputCls} value={form.to_date} onChange={e => setForm(p => ({ ...p, to_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Reason</Label>
              <Textarea rows={2} className="resize-y" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setApplyOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={applyLeave} disabled={saving} className="min-w-28">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Bal({ v, strong, border }: { v: number; strong?: boolean; border?: boolean }) {
  return (
    <td className={`px-3 py-2.5 text-center tabular-nums ${border ? 'border-l' : ''} ${strong ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
      {v}
    </td>
  )
}

function Empty({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-14 border rounded-2xl bg-white">
      <Icon className="w-9 h-9 mx-auto mb-3 text-gray-200" />
      <p className="font-semibold text-gray-500 text-sm">{text}</p>
    </div>
  )
}

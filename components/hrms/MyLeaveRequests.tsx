'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { CalendarPlus, Clock, CheckCircle2, XCircle, Ban } from 'lucide-react'

interface LeaveRow {
  id: string
  leave_type: string
  from_date: string
  to_date: string
  days: number | null
  reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  rejection_reason: string | null
  created_at: string
}

const TYPES = [
  { value: 'casual', label: 'Casual Leave (CL)' },
  { value: 'sick', label: 'Sick Leave (SL)' },
  { value: 'unpaid', label: 'Unpaid Leave (LWP)' },
]

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

/** Inclusive day count — HR adjusts for weekly offs and holidays while approving. */
const dayCount = (from: string, to: string) =>
  Math.floor((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000) + 1

export default function MyLeaveRequests({ employeeId }: { employeeId: string }) {
  const supabase = createClient()
  const db = supabase as unknown as { from: (t: string) => any }

  const [rows, setRows] = useState<LeaveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  const [form, setForm] = useState({ leave_type: 'casual', from_date: today, to_date: today, reason: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await db.from('leave_requests')
      .select('id, leave_type, from_date, to_date, days, reason, status, rejection_reason, created_at')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(20)
    setRows((data ?? []) as LeaveRow[])
    setLoading(false)
  }, [db, employeeId])

  useEffect(() => { load() }, [load])

  async function submit() {
    if (!form.from_date || !form.to_date) { toast.error('Dates chunein'); return }
    if (form.to_date < form.from_date) { toast.error('To date, from date ke baad honi chahiye'); return }
    if (!form.reason.trim()) { toast.error('Reason likhein'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await db.from('leave_requests').insert({
        employee_id: employeeId,
        leave_type: form.leave_type,
        from_date: form.from_date,
        to_date: form.to_date,
        days: dayCount(form.from_date, form.to_date),
        reason: form.reason.trim(),
        status: 'pending',
        applied_by: user?.id ?? null,
      })
      if (error) { toast.error(error.message); return }
      toast.success('Leave request bhej di gayi — HR approve karega')
      setOpen(false)
      setForm({ leave_type: 'casual', from_date: today, to_date: today, reason: '' })
      load()
    } finally {
      setSaving(false)
    }
  }

  async function cancelRequest(row: LeaveRow) {
    if (!confirm(`Cancel this ${row.leave_type} leave request?`)) return
    setBusyId(row.id)
    const { error } = await db.from('leave_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', row.id).eq('status', 'pending')
    setBusyId(null)
    if (error) { toast.error(error.message); return }
    toast.success('Request cancelled')
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'cancelled' } : r))
  }

  return (
    <div className="bg-white border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700 flex items-center gap-1.5">
          <CalendarPlus className="w-3.5 h-3.5" /> My Leave Requests
        </p>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => setOpen(true)}>
          <CalendarPlus className="w-3.5 h-3.5" /> Request Leave
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 px-4 py-6">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 px-4 py-6">Abhi tak koi leave request nahi</p>
      ) : (
        <div className="divide-y">
          {rows.map(r => (
            <div key={r.id} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 capitalize">
                  {TYPES.find(t => t.value === r.leave_type)?.label ?? r.leave_type}
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {fmtDate(r.from_date)}{r.to_date !== r.from_date ? ` – ${fmtDate(r.to_date)}` : ''}
                    {r.days ? ` · ${r.days} day${Number(r.days) === 1 ? '' : 's'}` : ''}
                  </span>
                </p>
                {r.reason && <p className="text-xs text-gray-500 mt-0.5">{r.reason}</p>}
                {r.status === 'rejected' && r.rejection_reason && (
                  <p className="text-xs text-red-600 mt-0.5">Reason: {r.rejection_reason}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${STATUS_CLS[r.status]}`}>
                  {r.status === 'pending' && <Clock className="w-3 h-3" />}
                  {r.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                  {r.status === 'rejected' && <XCircle className="w-3 h-3" />}
                  {r.status === 'cancelled' && <Ban className="w-3 h-3" />}
                  {r.status}
                </span>
                {r.status === 'pending' && (
                  <button onClick={() => cancelRequest(r)} disabled={busyId === r.id}
                    className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50">Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-blue-600" /> Request Leave
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Leave Type</Label>
              <select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
                className="w-full border rounded-md px-3 h-10 text-sm bg-white">
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">From</Label>
                <Input type="date" value={form.from_date}
                  onChange={e => setForm(f => ({ ...f, from_date: e.target.value, to_date: f.to_date < e.target.value ? e.target.value : f.to_date }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To</Label>
                <Input type="date" value={form.to_date} min={form.from_date}
                  onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {dayCount(form.from_date, form.to_date)} day{dayCount(form.from_date, form.to_date) === 1 ? '' : 's'} — HR weekly off aur holiday adjust kar dega
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Textarea rows={3} value={form.reason} placeholder="Chhutti ki wajah likhein…"
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="resize-none" />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={submit} disabled={saving} className="min-w-28">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Send Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

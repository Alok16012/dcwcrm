'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, CalendarClock, Pencil, Trash2, Video, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { lmsDb, fmtDateTime, toIstInput, istInputToIso, type LmsLiveClass } from '@/lib/lms/shared'
import { Field, inputCls, textareaCls, EmptyState } from '../form'
import { cn } from '@/lib/utils'

const STATUS_STYLE: Record<LmsLiveClass['status'], string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const EMPTY = { title: '', description: '', start_at: '', duration_min: '60', join_url: '', recording_url: '', status: 'scheduled' as LmsLiveClass['status'] }

export function ClassesTab({ courseId, classes }: { courseId: string; classes: LmsLiveClass[] }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ open: boolean; cls?: LmsLiveClass }>({ open: false })
  const [f, setF] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<LmsLiveClass | null>(null)

  const [now] = useState(() => Date.now())

  function openDialog(c?: LmsLiveClass) {
    setF(c ? {
      title: c.title, description: c.description, start_at: toIstInput(c.start_at), duration_min: String(c.duration_min),
      join_url: c.join_url ?? '', recording_url: c.recording_url ?? '', status: c.status,
    } : EMPTY)
    setDialog({ open: true, cls: c })
  }
  const upcoming = classes.filter(c => c.status === 'scheduled' && new Date(c.start_at).getTime() + c.duration_min * 60_000 >= now)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
  const past = classes.filter(c => !upcoming.includes(c))

  async function save() {
    if (!f.title.trim() || !f.start_at) { toast.error('Title and start time are required'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      title: f.title.trim(), description: f.description.trim(), start_at: istInputToIso(f.start_at),
      duration_min: Math.max(1, parseInt(f.duration_min, 10) || 60),
      join_url: f.join_url.trim() || null, recording_url: f.recording_url.trim() || null, status: f.status,
    }
    const db = lmsDb(supabase)
    let error
    if (dialog.cls) {
      ({ error } = await db.from('lms_live_classes').update(payload).eq('id', dialog.cls.id))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      ;({ error } = await db.from('lms_live_classes').insert({ ...payload, course_id: courseId, created_by: user?.id ?? null }))
    }
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(dialog.cls ? 'Class updated' : 'Class scheduled')
    setDialog({ open: false })
    router.refresh()
  }

  async function remove() {
    if (!toDelete) return
    const { error } = await lmsDb(createClient()).from('lms_live_classes').delete().eq('id', toDelete.id)
    setToDelete(null)
    if (error) { toast.error(error.message); return }
    toast.success('Class deleted')
    router.refresh()
  }

  const Row = ({ c }: { c: LmsLiveClass }) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="h-9 w-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
        <CalendarClock className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
        <p className="text-[11px] text-gray-500">{fmtDateTime(c.start_at)} IST · {c.duration_min} min</p>
      </div>
      {c.join_url && c.status === 'scheduled' && (
        <a href={c.join_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
          Join link <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {c.recording_url && (
        <a href={c.recording_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
          <Video className="h-3 w-3" /> Recording
        </a>
      )}
      <span className={cn('text-[11px] font-semibold rounded-full px-2 py-0.5 capitalize', STATUS_STYLE[c.status])}>{c.status}</span>
      <button onClick={() => openDialog(c)} className="h-7 w-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Edit class">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => setToDelete(c)} className="h-7 w-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete class">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <p className="text-sm text-gray-500">Schedule Zoom / Google Meet sessions. Add the recording link afterwards.</p>
        <Button onClick={() => openDialog()} className="bg-blue-600 hover:bg-blue-700 gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Schedule class
        </Button>
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No live classes scheduled" />
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Upcoming</p>
              <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">{upcoming.map(c => <Row key={c.id} c={c} />)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Past & cancelled</p>
              <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">{past.map(c => <Row key={c.id} c={c} />)}</div>
            </div>
          )}
        </>
      )}

      <Dialog open={dialog.open} onOpenChange={o => { if (!o) setDialog({ open: false }) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dialog.cls ? 'Edit live class' : 'Schedule live class'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Title"><input className={inputCls} autoFocus value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts at (IST)"><input className={inputCls} type="datetime-local" value={f.start_at} onChange={e => setF(p => ({ ...p, start_at: e.target.value }))} /></Field>
              <Field label="Duration (min)"><input className={inputCls} type="number" min={1} value={f.duration_min} onChange={e => setF(p => ({ ...p, duration_min: e.target.value }))} /></Field>
            </div>
            <Field label="Join link (Zoom / Meet)"><input className={inputCls} value={f.join_url} onChange={e => setF(p => ({ ...p, join_url: e.target.value }))} placeholder="https://meet.google.com/…" /></Field>
            <Field label="Recording link (after class)"><input className={inputCls} value={f.recording_url} onChange={e => setF(p => ({ ...p, recording_url: e.target.value }))} placeholder="https://youtu.be/…" /></Field>
            <Field label="Description (optional)"><textarea className={textareaCls} rows={2} value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} /></Field>
            <Field label="Status">
              <select className={inputCls} value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value as LmsLiveClass['status'] }))}>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog({ open: false })} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onCancel={() => setToDelete(null)} onConfirm={remove} destructive confirmLabel="Delete"
        title="Delete live class?" description={toDelete ? `"${toDelete.title}" will be removed.` : ''} />
    </div>
  )
}

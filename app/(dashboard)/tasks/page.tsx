'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import {
  Plus, CheckCircle2, Clock, AlertTriangle, Zap, Star,
  User, Calendar, SlidersHorizontal, ClipboardList, Pencil, Trash2,
} from 'lucide-react'

type Urgency = 'low' | 'medium' | 'high' | 'urgent'
type Status  = 'pending' | 'in_progress' | 'done'

interface Assignee { id: string; name: string; type: 'staff' | 'associate'; user_id: string; associate_id?: string }
interface Task {
  id: string; title: string; description: string | null
  urgency: Urgency; assigned_to: string; assigned_to_name: string
  assigned_to_associate_id: string | null
  created_by: string; created_by_name: string
  due_date: string; reminder_date: string | null; status: Status; rating: number | null
  completion_note: string | null; created_at: string
}

const URGENCY: Record<Urgency, { label: string; color: string; icon: React.ReactNode }> = {
  low:    { label: 'Low',    color: 'bg-slate-100 text-slate-600 border-slate-200',    icon: <Clock className="w-3 h-3" /> },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: <SlidersHorizontal className="w-3 h-3" /> },
  high:   { label: 'High',   color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <AlertTriangle className="w-3 h-3" /> },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200',          icon: <Zap className="w-3 h-3" /> },
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`w-7 h-7 rounded transition-colors ${n <= value ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-300'}`}>
          <Star className="w-5 h-5 fill-current" />
        </button>
      ))}
    </div>
  )
}

// Description is a numbered checklist: Enter continues "1. 2. 3.", Enter on an
// empty item ends the list. Consecutive numbered lines are kept in sequence.
const NUM_LINE = /^(\s*)(\d+)\.\s?/

function renumber(text: string) {
  let n = 0
  return text.split('\n').map(line => {
    const m = line.match(NUM_LINE)
    if (!m) { n = 0; return line }
    n += 1
    return `${m[1]}${n}. ${line.slice(m[0].length)}`
  }).join('\n')
}

function handleListKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, setValue: (v: string) => void) {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
  const el = e.currentTarget
  const { value, selectionStart, selectionEnd } = el
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
  const line = value.slice(lineStart, selectionStart)
  const m = line.match(NUM_LINE)
  if (!m) return
  e.preventDefault()

  let next: string
  let caret: number
  if (line.slice(m[0].length).trim() === '' && value.slice(selectionEnd).split('\n')[0].trim() === '') {
    // Empty item: drop the number and stop the list
    next = value.slice(0, lineStart) + value.slice(selectionEnd)
    caret = lineStart
  } else {
    const insert = `\n${m[1]}${Number(m[2]) + 1}. `
    next = value.slice(0, selectionStart) + insert + value.slice(selectionEnd)
    caret = selectionStart + insert.length
  }
  const renumbered = renumber(next)
  caret += renumbered.slice(0, caret).length - next.slice(0, caret).length
  setValue(renumbered)
  requestAnimationFrame(() => el.setSelectionRange(caret, caret))
}

// Strip trailing empty list items like "3. " before saving
const cleanDescription = (text: string) =>
  text.split('\n').filter(l => !/^\s*\d+\.\s*$/.test(l)).join('\n').trim() || null

const today = () => new Date().toISOString().slice(0, 10)
function isToday(d: string) { return d === today() }
function isPast(d: string)  { return d < today() }
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TasksPage() {
  const supabase = createClient()
  const db = supabase as any

  const [myTasks, setMyTasks]         = useState<Task[]>([])
  const [createdTasks, setCreatedTasks] = useState<Task[]>([])
  const [loading, setLoading]         = useState(true)
  const [meId, setMeId]               = useState('')
  const [meName, setMeName]           = useState('')
  const [assignees, setAssignees]     = useState<Assignee[]>([])
  const [tab, setTab]                 = useState<'mine' | 'created'>('mine')
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all')

  // Create dialog
  const [createOpen, setCreateOpen]   = useState(false)
  const [form, setForm]               = useState({ title: '', description: '', urgency: 'medium' as Urgency, assigned_to: '', due_date: '', reminder_date: '' })
  const [saving, setSaving]           = useState(false)
  // New tasks can go to several people at once — one task row per person
  const [assignTo, setAssignTo]       = useState<string[]>([])
  // When set, the create dialog edits this task instead of creating a new one
  const [editTask, setEditTask]       = useState<Task | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  // Done dialog
  const [doneTask, setDoneTask]       = useState<Task | null>(null)
  const [rating, setRating]           = useState(0)
  const [doneNote, setDoneNote]       = useState('')
  const [completing, setCompleting]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setMeId(user.id)

    const [profileRes, staffRes, assocRes, mineRes, createdRes] = await Promise.all([
      db.from('profiles').select('full_name').eq('id', user.id).single(),
      db.from('profiles').select('id, full_name').neq('role', 'associate').order('full_name'),
      db.from('associates').select('id, name, user_id').eq('status', 'approved').order('name'),
      db.from('tasks').select('*').eq('assigned_to', user.id).order('due_date'),
      db.from('tasks').select('*').eq('created_by', user.id).order('due_date'),
    ])

    setMeName(profileRes.data?.full_name ?? 'Me')
    const staffList: Assignee[] = ((staffRes.data ?? []) as any[]).map(p => ({ id: p.id, name: p.full_name, type: 'staff', user_id: p.id }))
    const assocList: Assignee[] = ((assocRes.data ?? []) as any[]).map(a => ({ id: a.id, name: a.name, type: 'associate', user_id: a.user_id, associate_id: a.id }))
    setAssignees([...staffList, ...assocList])
    setMyTasks((mineRes.data ?? []) as Task[])
    setCreatedTasks(((createdRes.data ?? []) as Task[]).filter(t => t.assigned_to !== user.id))
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  async function createTask() {
    const chosen = assignees.filter(a => assignTo.includes(a.id))
    if (!form.title.trim() || chosen.length === 0 || !form.due_date) {
      toast.error('Title, at least one person and due date are required'); return
    }
    setSaving(true)
    const payloads = chosen.map(assignee => ({
      title: form.title.trim(), description: cleanDescription(form.description),
      urgency: form.urgency,
      assigned_to: assignee.user_id, assigned_to_name: assignee.name,
      assigned_to_associate_id: assignee.type === 'associate' ? assignee.associate_id : null,
      created_by: meId, created_by_name: meName,
      due_date: form.due_date, reminder_date: form.reminder_date || null, status: 'pending',
    }))
    const { data, error } = await db.from('tasks').insert(payloads).select()
    if (error) { toast.error('Failed to create task'); setSaving(false); return }

    // Notify every associate the task went to
    const notifications = chosen
      .filter(a => a.type === 'associate' && a.associate_id)
      .map(a => ({
        associate_id: a.associate_id,
        title: `New Task: ${form.title.trim()}`,
        message: `Due: ${fmtDate(form.due_date)}. Assigned by ${meName}.`,
      }))
    if (notifications.length) await db.from('associate_notifications').insert(notifications)

    const created = (data ?? []) as Task[]
    toast.success(created.length > 1 ? `Task assigned to ${created.length} people` : 'Task created!')
    setMyTasks(prev => [...created.filter(t => t.assigned_to === meId), ...prev])
    setCreatedTasks(prev => [...created.filter(t => t.assigned_to !== meId), ...prev])
    setForm(EMPTY_FORM)
    setAssignTo([])
    setCreateOpen(false)
    setSaving(false)
  }

  const EMPTY_FORM = { title: '', description: '', urgency: 'medium' as Urgency, assigned_to: '', due_date: '', reminder_date: '' }

  function openCreate() {
    setEditTask(null)
    setForm(EMPTY_FORM)
    setAssignTo([])
    setCreateOpen(true)
  }

  function openEdit(task: Task) {
    const assignee = assignees.find(a =>
      task.assigned_to_associate_id ? a.associate_id === task.assigned_to_associate_id : a.type === 'staff' && a.user_id === task.assigned_to)
    setEditTask(task)
    setForm({
      title: task.title, description: task.description ?? '', urgency: task.urgency,
      assigned_to: assignee?.id ?? '', due_date: task.due_date, reminder_date: task.reminder_date ?? '',
    })
    setCreateOpen(true)
  }

  async function updateTask() {
    if (!editTask) return
    if (!form.title.trim() || !form.assigned_to || !form.due_date) {
      toast.error('Title, assignee and due date are required'); return
    }
    const assignee = assignees.find(a => a.id === form.assigned_to)
    if (!assignee) { toast.error('Select who this task is assigned to'); return }
    setSaving(true)
    const patch = {
      title: form.title.trim(), description: cleanDescription(form.description),
      urgency: form.urgency,
      assigned_to: assignee.user_id, assigned_to_name: assignee.name,
      assigned_to_associate_id: assignee.type === 'associate' ? assignee.associate_id : null,
      due_date: form.due_date, reminder_date: form.reminder_date || null,
    }
    const { data, error } = await db.from('tasks').update(patch).eq('id', editTask.id).select().single()
    setSaving(false)
    if (error || !data) { toast.error('Failed to update task'); return }
    const updated = data as Task
    // The assignee may have changed, so re-bucket the task between the two tabs
    setMyTasks(prev => updated.assigned_to === meId
      ? (prev.some(t => t.id === updated.id) ? prev.map(t => t.id === updated.id ? updated : t) : [updated, ...prev])
      : prev.filter(t => t.id !== updated.id))
    setCreatedTasks(prev => updated.assigned_to !== meId
      ? (prev.some(t => t.id === updated.id) ? prev.map(t => t.id === updated.id ? updated : t) : [updated, ...prev])
      : prev.filter(t => t.id !== updated.id))
    toast.success('Task updated')
    setEditTask(null); setForm(EMPTY_FORM); setCreateOpen(false)
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete this task?\n\n${task.title}`)) return
    setDeletingId(task.id)
    const { error } = await db.from('tasks').delete().eq('id', task.id)
    setDeletingId(null)
    if (error) { toast.error('Failed to delete task'); return }
    setMyTasks(prev => prev.filter(t => t.id !== task.id))
    setCreatedTasks(prev => prev.filter(t => t.id !== task.id))
    toast.success('Task deleted')
  }

  async function startTask(id: string) {
    await db.from('tasks').update({ status: 'in_progress' }).eq('id', id)
    setMyTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'in_progress' } : t))
  }

  async function markDone() {
    if (!doneTask || rating === 0) { toast.error('Please give a rating'); return }
    setCompleting(true)
    const { error } = await db.from('tasks').update({ status: 'done', rating, completion_note: doneNote.trim() || null }).eq('id', doneTask.id)
    if (error) { toast.error('Update failed'); setCompleting(false); return }
    setMyTasks(prev => prev.map(t => t.id === doneTask.id ? { ...t, status: 'done', rating, completion_note: doneNote.trim() || null } : t))
    toast.success('Marked as done!')
    setDoneTask(null); setRating(0); setDoneNote(''); setCompleting(false)
  }

  const display = (tab === 'mine' ? myTasks : createdTasks).filter(t => filterStatus === 'all' || t.status === filterStatus)
  const pendingMine = myTasks.filter(t => t.status !== 'done')
  const todayCount = pendingMine.filter(t => isToday(t.due_date)).length
  const overdueCount = pendingMine.filter(t => isPast(t.due_date) && !isToday(t.due_date)).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="My Tasks"
          description={`${pendingMine.length} pending${todayCount ? ` · ${todayCount} due today` : ''}${overdueCount ? ` · ${overdueCount} overdue` : ''}`}
        />
        <Button onClick={openCreate} className="gap-1.5 bg-blue-600 hover:bg-blue-700 h-9 text-sm">
          <Plus className="w-4 h-4" /> New Task
        </Button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setTab('mine')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'mine' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            Assigned to Me
            {pendingMine.length > 0 && <span className="ml-1.5 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{pendingMine.length}</span>}
          </button>
          <button onClick={() => setTab('created')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'created' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            Created by Me
            {createdTasks.filter(t => t.status !== 'done').length > 0 && <span className="ml-1.5 bg-blue-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{createdTasks.filter(t => t.status !== 'done').length}</span>}
          </button>
        </div>
        <div className="flex gap-1.5 ml-auto flex-wrap">
          {(['all','pending','in_progress','done'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${filterStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
              {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : display.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-white">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-sm">{tab === 'mine' ? 'No tasks assigned to you' : 'No tasks created by you'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {display.map(task => {
            const urg = URGENCY[task.urgency]
            const dueToday = isToday(task.due_date) && task.status !== 'done'
            const overdue  = isPast(task.due_date) && !isToday(task.due_date) && task.status !== 'done'
            return (
              <div key={task.id} className={`rounded-xl border p-4 bg-white transition-all ${dueToday ? 'border-amber-300 bg-amber-50' : overdue ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${task.urgency === 'urgent' ? 'bg-red-500' : task.urgency === 'high' ? 'bg-orange-400' : task.urgency === 'medium' ? 'bg-blue-400' : 'bg-slate-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>{task.title}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {task.created_by === meId && (
                          <>
                            <button onClick={() => openEdit(task)} title="Edit task"
                              className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteTask(task)} disabled={deletingId === task.id} title="Delete task"
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <Badge variant="outline" className={`text-[10px] gap-1 ${urg.color}`}>{urg.icon}{urg.label}</Badge>
                        {task.status === 'done' && <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 border-green-200">Done</Badge>}
                        {task.status === 'in_progress' && <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">In Progress</Badge>}
                      </div>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{task.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs">
                      {tab === 'created' && <span className="flex items-center gap-1 text-slate-500"><User className="w-3 h-3" />{task.assigned_to_name}</span>}
                      {tab === 'mine' && <span className="text-muted-foreground">by {task.created_by_name}</span>}
                      <span className={`flex items-center gap-1 font-medium ${dueToday ? 'text-amber-600' : overdue ? 'text-red-600' : 'text-slate-500'}`}>
                        <Calendar className="w-3 h-3" />
                        {dueToday ? 'Due Today!' : overdue ? `Overdue: ${fmtDate(task.due_date)}` : fmtDate(task.due_date)}
                      </span>
                      {task.rating && <span className="flex items-center gap-0.5 text-yellow-600">{Array.from({ length: task.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}</span>}
                    </div>
                    {task.completion_note && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mt-2">{task.completion_note}</p>}
                    {tab === 'mine' && task.status !== 'done' && (
                      <div className="flex gap-2 mt-3">
                        {task.status === 'pending' && (
                          <Button size="sm" variant="outline" onClick={() => startTask(task.id)}
                            className="h-7 text-xs gap-1 text-blue-700 border-blue-200 hover:bg-blue-50">
                            <Clock className="w-3 h-3" /> Start
                          </Button>
                        )}
                        <Button size="sm" onClick={() => { setDoneTask(task); setRating(0); setDoneNote('') }}
                          className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700">
                          <CheckCircle2 className="w-3 h-3" /> Mark Done
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) setEditTask(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editTask ? <><Pencil className="w-5 h-5 text-blue-600" /> Edit Task</> : <><Plus className="w-5 h-5 text-blue-600" /> New Task</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div><Label className="text-xs mb-1.5">Title *</Label><Input placeholder="e.g. Follow up with student…" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div>
              <Label className="text-xs mb-1.5">Description <span className="text-slate-400 font-normal">(press Enter for next point)</span></Label>
              <Textarea placeholder="1. 100 calls" rows={4} value={form.description}
                onFocus={() => { if (!form.description) setForm(p => ({ ...p, description: '1. ' })) }}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                onKeyDown={e => handleListKeyDown(e, v => setForm(p => ({ ...p, description: v })))}
                className="resize-y min-h-24" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1.5">Urgency *</Label>
                <select value={form.urgency} onChange={e => setForm(p => ({ ...p, urgency: e.target.value as Urgency }))}
                  className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
              </div>
              {editTask && (
                <div><Label className="text-xs mb-1.5">Assign To *</Label>
                  <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select person…</option>
                    <optgroup label="Staff">{assignees.filter(a => a.type === 'staff').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
                    <optgroup label="Associates">{assignees.filter(a => a.type === 'associate').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
                  </select>
                </div>
              )}
            </div>
            {!editTask && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs">Assign To * <span className="text-slate-400 font-normal">(tick one or more)</span></Label>
                  {assignTo.length > 0 && (
                    <button type="button" onClick={() => setAssignTo([])} className="text-[11px] text-blue-600 hover:underline">
                      {assignTo.length} selected · Clear
                    </button>
                  )}
                </div>
                <div className="max-h-44 overflow-y-auto rounded-md border border-input p-2 space-y-2">
                  {(['staff', 'associate'] as const).map(type => {
                    const group = assignees.filter(a => a.type === type)
                    if (group.length === 0) return null
                    return (
                      <div key={type}>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 px-1 mb-1">{type === 'staff' ? 'Staff' : 'Associates'}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2">
                          {group.map(a => (
                            <label key={a.id} className={`flex items-center gap-2 px-1.5 py-1 rounded text-sm cursor-pointer ${assignTo.includes(a.id) ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-50'}`}>
                              <input type="checkbox" className="h-4 w-4 accent-blue-600"
                                checked={assignTo.includes(a.id)}
                                onChange={() => setAssignTo(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id])} />
                              <span className="truncate">{a.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1.5">Due Date *</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1.5">Reminder Date</Label><Input type="date" value={form.reminder_date} onChange={e => setForm(p => ({ ...p, reminder_date: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={editTask ? updateTask : createTask} disabled={saving}>
                {editTask ? (saving ? 'Saving…' : 'Save Changes') : (saving ? 'Creating…' : 'Create Task')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Done Dialog */}
      <Dialog open={!!doneTask} onOpenChange={open => !open && setDoneTask(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-green-700"><CheckCircle2 className="w-5 h-5" /> Mark Done</DialogTitle></DialogHeader>
          {doneTask && (
            <div className="space-y-4 mt-1">
              <p className="text-sm font-medium text-slate-800">{doneTask.title}</p>
              <div><Label className="text-xs mb-2">Rating * (1-5 stars)</Label><StarRating value={rating} onChange={setRating} /></div>
              <div><Label className="text-xs mb-1.5">Note (optional)</Label><Textarea placeholder="What was done…" rows={2} value={doneNote} onChange={e => setDoneNote(e.target.value)} className="resize-none" /></div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDoneTask(null)}>Cancel</Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={markDone} disabled={completing}>{completing ? 'Saving…' : 'Done'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

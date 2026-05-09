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
  User, Calendar, SlidersHorizontal, ClipboardList,
} from 'lucide-react'

type Urgency = 'low' | 'medium' | 'high' | 'urgent'
type Status  = 'pending' | 'in_progress' | 'done'

interface Assignee { id: string; name: string; type: 'staff' | 'associate'; user_id: string; associate_id?: string }
interface Task {
  id: string; title: string; description: string | null
  urgency: Urgency; assigned_to: string; assigned_to_name: string
  assigned_to_associate_id: string | null
  created_by: string; created_by_name: string
  due_date: string; status: Status; rating: number | null
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
    if (!form.title.trim() || !form.assigned_to || !form.due_date) {
      toast.error('Title, assignee and due date are required'); return
    }
    setSaving(true)
    const assignee = assignees.find(a => a.id === form.assigned_to)!
    const payload: any = {
      title: form.title.trim(), description: form.description.trim() || null,
      urgency: form.urgency,
      assigned_to: assignee.user_id, assigned_to_name: assignee.name,
      assigned_to_associate_id: assignee.type === 'associate' ? assignee.associate_id : null,
      created_by: meId, created_by_name: meName,
      due_date: form.due_date, reminder_date: form.reminder_date || null, status: 'pending',
    }
    const { data, error } = await db.from('tasks').insert(payload).select().single()
    if (error) { toast.error('Failed to create task'); setSaving(false); return }

    // Notify associate if task assigned to one
    if (assignee.type === 'associate' && assignee.associate_id) {
      await db.from('associate_notifications').insert({
        associate_id: assignee.associate_id,
        title: `New Task: ${form.title.trim()}`,
        message: `Due: ${fmtDate(form.due_date)}. Assigned by ${meName}.`,
      })
    }

    toast.success('Task created!')
    if (assignee.user_id === meId) setMyTasks(prev => [data as Task, ...prev])
    else setCreatedTasks(prev => [data as Task, ...prev])
    setForm({ title: '', description: '', urgency: 'medium', assigned_to: '', due_date: '', reminder_date: '' })
    setCreateOpen(false)
    setSaving(false)
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
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5 bg-blue-600 hover:bg-blue-700 h-9 text-sm">
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
                      <div className="flex gap-1.5 flex-shrink-0">
                        <Badge variant="outline" className={`text-[10px] gap-1 ${urg.color}`}>{urg.icon}{urg.label}</Badge>
                        {task.status === 'done' && <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 border-green-200">Done</Badge>}
                        {task.status === 'in_progress' && <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">In Progress</Badge>}
                      </div>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-blue-600" /> New Task</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-1">
            <div><Label className="text-xs mb-1.5">Title *</Label><Input placeholder="e.g. Follow up with student…" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label className="text-xs mb-1.5">Description</Label><Textarea placeholder="Details…" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="resize-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1.5">Urgency *</Label>
                <select value={form.urgency} onChange={e => setForm(p => ({ ...p, urgency: e.target.value as Urgency }))}
                  className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
              </div>
              <div><Label className="text-xs mb-1.5">Assign To *</Label>
                <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select person…</option>
                  <optgroup label="Staff">{assignees.filter(a => a.type === 'staff').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
                  <optgroup label="Associates">{assignees.filter(a => a.type === 'associate').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1.5">Due Date *</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1.5">Reminder Date</Label><Input type="date" value={form.reminder_date} onChange={e => setForm(p => ({ ...p, reminder_date: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={createTask} disabled={saving}>{saving ? 'Creating…' : 'Create Task'}</Button>
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

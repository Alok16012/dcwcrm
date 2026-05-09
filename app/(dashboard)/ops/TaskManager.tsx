'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Plus, CheckCircle2, Clock, AlertTriangle, Zap, Star,
  User, Calendar, SlidersHorizontal, Trash2, ChevronDown,
} from 'lucide-react'

type Urgency = 'low' | 'medium' | 'high' | 'urgent'
type Status  = 'pending' | 'in_progress' | 'done'

interface Assignee { id: string; name: string; type: 'staff' | 'associate'; user_id: string }
interface Task {
  id: string
  title: string
  description: string | null
  urgency: Urgency
  assigned_to: string
  assigned_to_name: string
  assigned_to_associate_id: string | null
  created_by: string
  created_by_name: string
  due_date: string
  reminder_date: string | null
  status: Status
  rating: number | null
  completion_note: string | null
  created_at: string
}

const URGENCY_META: Record<Urgency, { label: string; color: string; icon: React.ReactNode }> = {
  low:    { label: 'Low',    color: 'bg-slate-100 text-slate-600 border-slate-200',      icon: <Clock className="w-3 h-3" /> },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200',         icon: <SlidersHorizontal className="w-3 h-3" /> },
  high:   { label: 'High',   color: 'bg-orange-100 text-orange-700 border-orange-200',   icon: <AlertTriangle className="w-3 h-3" /> },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200',            icon: <Zap className="w-3 h-3" /> },
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  pending:     { label: 'Pending',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  done:        { label: 'Done',        color: 'bg-green-100 text-green-700 border-green-200' },
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`w-7 h-7 rounded transition-colors ${n <= value ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-300'}`}>
          <Star className="w-5 h-5 fill-current" />
        </button>
      ))}
    </div>
  )
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().slice(0, 10)
}
function isPast(dateStr: string) {
  return dateStr < new Date().toISOString().slice(0, 10)
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TaskManager() {
  const supabase = createClient()
  const db = supabase as any

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [meId, setMeId] = useState<string>('')
  const [meName, setMeName] = useState<string>('')

  // Filters
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all')
  const [filterUrgency, setFilterUrgency] = useState<Urgency | 'all'>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')

  // Create task dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', urgency: 'medium' as Urgency,
    assigned_to: '', due_date: '', reminder_date: '',
  })
  const [saving, setSaving] = useState(false)

  // Complete task dialog
  const [doneTask, setDoneTask] = useState<Task | null>(null)
  const [rating, setRating] = useState(0)
  const [completionNote, setCompletionNote] = useState('')
  const [completing, setCompleting] = useState(false)

  // Status change
  const [changingStatus, setChangingStatus] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setMeId(user.id)

    const [profileRes, staffRes, assocRes, taskRes] = await Promise.all([
      db.from('profiles').select('full_name').eq('id', user.id).single(),
      db.from('profiles').select('id, full_name, role').neq('role', 'associate').order('full_name'),
      db.from('associates').select('id, name, user_id').eq('status', 'approved').order('name'),
      db.from('tasks').select('*').order('due_date', { ascending: true }),
    ])

    setMeName(profileRes.data?.full_name ?? 'Me')

    const staffList: Assignee[] = ((staffRes.data ?? []) as any[]).map(p => ({
      id: p.id, name: p.full_name, type: 'staff', user_id: p.id,
    }))
    const assocList: Assignee[] = ((assocRes.data ?? []) as any[]).map(a => ({
      id: a.id, name: a.name, type: 'associate', user_id: a.user_id,
    }))
    setAssignees([...staffList, ...assocList])
    setTasks((taskRes.data ?? []) as Task[])
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { loadData() }, [loadData])

  async function createTask() {
    if (!form.title.trim() || !form.assigned_to || !form.due_date) {
      toast.error('Title, assignee and due date are required')
      return
    }
    setSaving(true)
    const assignee = assignees.find(a => a.id === form.assigned_to)!
    const payload: any = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      urgency: form.urgency,
      assigned_to: assignee.user_id,
      assigned_to_name: assignee.name,
      assigned_to_associate_id: assignee.type === 'associate' ? assignee.id : null,
      created_by: meId,
      created_by_name: meName,
      due_date: form.due_date,
      reminder_date: form.reminder_date || null,
      status: 'pending',
    }
    const { data, error } = await db.from('tasks').insert(payload).select().single()
    if (error) { toast.error('Failed to create task'); setSaving(false); return }

    // Notify associate if task assigned to one
    if (assignee.type === 'associate') {
      await db.from('associate_notifications').insert({
        associate_id: assignee.id,
        title: `New Task: ${form.title.trim()}`,
        message: `Due: ${new Date(form.due_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}. Assigned by ${meName}.`,
      })
    }

    toast.success('Task created')
    setTasks(prev => [data as Task, ...prev].sort((a, b) => a.due_date.localeCompare(b.due_date)))
    setForm({ title: '', description: '', urgency: 'medium', assigned_to: '', due_date: '', reminder_date: '' })
    setCreateOpen(false)
    setSaving(false)
  }

  async function markDone() {
    if (!doneTask || rating === 0) { toast.error('Please give a rating'); return }
    setCompleting(true)
    const { error } = await db.from('tasks').update({
      status: 'done', rating, completion_note: completionNote.trim() || null,
    }).eq('id', doneTask.id)
    if (error) { toast.error('Update failed'); setCompleting(false); return }
    setTasks(prev => prev.map(t => t.id === doneTask.id ? { ...t, status: 'done', rating, completion_note: completionNote.trim() || null } : t))
    toast.success('Task marked as done')
    setDoneTask(null); setRating(0); setCompletionNote('')
    setCompleting(false)
  }

  async function changeStatus(taskId: string, status: Status) {
    setChangingStatus(taskId)
    const { error } = await db.from('tasks').update({ status }).eq('id', taskId)
    if (!error) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    else toast.error('Update failed')
    setChangingStatus(null)
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return
    const { error } = await db.from('tasks').delete().eq('id', taskId)
    if (!error) { setTasks(prev => prev.filter(t => t.id !== taskId)); toast.success('Task deleted') }
    else toast.error('Delete failed')
  }

  const filtered = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterUrgency !== 'all' && t.urgency !== filterUrgency) return false
    if (filterAssignee !== 'all' && t.assigned_to !== filterAssignee) return false
    return true
  })

  const todayCount = tasks.filter(t => t.status !== 'done' && isToday(t.due_date)).length
  const overdueCount = tasks.filter(t => t.status !== 'done' && isPast(t.due_date) && !isToday(t.due_date)).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Task Management</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tasks.filter(t => t.status !== 'done').length} active
            {todayCount > 0 && <span className="text-amber-600 font-medium"> · {todayCount} due today</span>}
            {overdueCount > 0 && <span className="text-red-600 font-medium"> · {overdueCount} overdue</span>}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5 bg-blue-600 hover:bg-blue-700 h-9 text-sm">
          <Plus className="w-4 h-4" /> New Task
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['pending', 'in_progress', 'done'] as Status[]).map(s => (
          <button key={s} onClick={() => setFilterStatus(prev => prev === s ? 'all' : s)}
            className={`rounded-xl border p-3 text-left transition-all ${filterStatus === s ? 'ring-2 ring-blue-500 border-blue-300' : 'bg-white hover:border-slate-300'}`}>
            <p className="text-xs text-muted-foreground">{STATUS_META[s].label}</p>
            <p className="text-xl font-bold text-gray-900">{tasks.filter(t => t.status === s).length}</p>
          </button>
        ))}
        <button onClick={() => setFilterUrgency(prev => prev === 'urgent' ? 'all' : 'urgent')}
          className={`rounded-xl border p-3 text-left transition-all ${filterUrgency === 'urgent' ? 'ring-2 ring-red-500 border-red-300' : 'bg-white hover:border-slate-300'}`}>
          <p className="text-xs text-red-600">Urgent</p>
          <p className="text-xl font-bold text-red-700">{tasks.filter(t => t.urgency === 'urgent' && t.status !== 'done').length}</p>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="h-8 rounded-lg border border-slate-200 px-3 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value as any)}
          className="h-8 rounded-lg border border-slate-200 px-3 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Urgency</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
          className="h-8 rounded-lg border border-slate-200 px-3 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Assignees</option>
          {assignees.map(a => <option key={a.user_id} value={a.user_id}>{a.name}</option>)}
        </select>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-white">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-sm">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const urg = URGENCY_META[task.urgency]
            const sta = STATUS_META[task.status]
            const due = task.due_date
            const dueBadge = isToday(due) ? 'bg-amber-50 border-amber-300' : isPast(due) && task.status !== 'done' ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200'
            return (
              <div key={task.id} className={`rounded-xl border p-4 transition-all ${dueBadge}`}>
                <div className="flex items-start gap-3">
                  {/* Urgency stripe */}
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                    task.urgency === 'urgent' ? 'bg-red-500' :
                    task.urgency === 'high'   ? 'bg-orange-400' :
                    task.urgency === 'medium' ? 'bg-blue-400' : 'bg-slate-300'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {task.title}
                        </p>
                        {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge variant="outline" className={`text-[10px] gap-1 ${urg.color}`}>
                          {urg.icon}{urg.label}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${sta.color}`}>{sta.label}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" /> {task.assigned_to_name}
                      </span>
                      <span className={`flex items-center gap-1 text-xs font-medium ${
                        isToday(due) ? 'text-amber-600' : isPast(due) && task.status !== 'done' ? 'text-red-600' : 'text-slate-500'
                      }`}>
                        <Calendar className="w-3 h-3" />
                        {isToday(due) ? 'Due Today' : isPast(due) && task.status !== 'done' ? `Overdue: ${fmtDate(due)}` : fmtDate(due)}
                      </span>
                      {task.status === 'done' && task.rating && (
                        <span className="flex items-center gap-0.5 text-xs text-yellow-600">
                          {Array.from({ length: task.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">by {task.created_by_name}</span>
                    </div>

                    {task.completion_note && (
                      <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 mt-2">
                        Note: {task.completion_note}
                      </p>
                    )}

                    {/* Actions */}
                    {task.status !== 'done' && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {task.status === 'pending' && (
                          <Button size="sm" variant="outline"
                            onClick={() => changeStatus(task.id, 'in_progress')}
                            disabled={changingStatus === task.id}
                            className="h-7 text-xs gap-1 text-blue-700 border-blue-200 hover:bg-blue-50">
                            <Clock className="w-3 h-3" /> Start
                          </Button>
                        )}
                        <Button size="sm" variant="outline"
                          onClick={() => { setDoneTask(task); setRating(0); setCompletionNote('') }}
                          className="h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50">
                          <CheckCircle2 className="w-3 h-3" /> Mark Done
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => deleteTask(task.id)}
                          className="h-7 text-xs gap-1 text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="w-3 h-3" />
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

      {/* Create Task Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" /> Create New Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div>
              <Label className="text-xs mb-1.5">Task Title *</Label>
              <Input placeholder="e.g. Follow up with student…" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs mb-1.5">Description</Label>
              <Textarea placeholder="Additional details…" rows={2} value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5">Urgency *</Label>
                <select value={form.urgency} onChange={e => setForm(p => ({ ...p, urgency: e.target.value as Urgency }))}
                  className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <Label className="text-xs mb-1.5">Assign To *</Label>
                <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select person…</option>
                  <optgroup label="Staff">
                    {assignees.filter(a => a.type === 'staff').map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Associates">
                    {assignees.filter(a => a.type === 'associate').map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5">Due Date *</Label>
                <Input type="date" value={form.due_date}
                  onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs mb-1.5">Reminder Date</Label>
                <Input type="date" value={form.reminder_date}
                  onChange={e => setForm(p => ({ ...p, reminder_date: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={createTask} disabled={saving}>
                {saving ? 'Creating…' : 'Create Task'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark Done Dialog */}
      <Dialog open={!!doneTask} onOpenChange={open => !open && setDoneTask(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" /> Mark Task Done
            </DialogTitle>
          </DialogHeader>
          {doneTask && (
            <div className="space-y-4 mt-1">
              <p className="text-sm font-medium text-slate-800">{doneTask.title}</p>
              <div>
                <Label className="text-xs mb-2">Rating * (1-5 stars)</Label>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div>
                <Label className="text-xs mb-1.5">Completion Note (optional)</Label>
                <Textarea placeholder="What was done, any remarks…" rows={2} value={completionNote}
                  onChange={e => setCompletionNote(e.target.value)} className="resize-none" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDoneTask(null)}>Cancel</Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={markDone} disabled={completing}>
                  {completing ? 'Saving…' : 'Done'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

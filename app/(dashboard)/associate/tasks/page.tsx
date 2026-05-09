'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  CheckCircle2, Clock, AlertTriangle, Zap, Star,
  Calendar, SlidersHorizontal, HeartHandshake,
} from 'lucide-react'

type Urgency = 'low' | 'medium' | 'high' | 'urgent'
type Status  = 'pending' | 'in_progress' | 'done'

interface Task {
  id: string
  title: string
  description: string | null
  urgency: Urgency
  assigned_to: string
  created_by_name: string
  due_date: string
  status: Status
  rating: number | null
  completion_note: string | null
  created_at: string
}

const URGENCY_META: Record<Urgency, { label: string; color: string; icon: React.ReactNode }> = {
  low:    { label: 'Low',    color: 'bg-slate-100 text-slate-600 border-slate-200',    icon: <Clock className="w-3 h-3" /> },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: <SlidersHorizontal className="w-3 h-3" /> },
  high:   { label: 'High',   color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <AlertTriangle className="w-3 h-3" /> },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200',          icon: <Zap className="w-3 h-3" /> },
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

function isToday(d: string) { return d === new Date().toISOString().slice(0, 10) }
function isPast(d: string)  { return d < new Date().toISOString().slice(0, 10) }
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AssociateTasksPage() {
  const supabase = createClient()
  const db = supabase as any

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all')

  // Mark done dialog
  const [doneTask, setDoneTask] = useState<Task | null>(null)
  const [rating, setRating] = useState(0)
  const [note, setNote] = useState('')
  const [completing, setCompleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await db.from('tasks').select('*').eq('assigned_to', user.id).order('due_date', { ascending: true })
    setTasks((data ?? []) as Task[])
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  async function startTask(id: string) {
    const { error } = await db.from('tasks').update({ status: 'in_progress' }).eq('id', id)
    if (!error) setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'in_progress' } : t))
    else toast.error('Update failed')
  }

  async function markDone() {
    if (!doneTask || rating === 0) { toast.error('Please give a rating'); return }
    setCompleting(true)
    const { error } = await db.from('tasks').update({
      status: 'done', rating, completion_note: note.trim() || null,
    }).eq('id', doneTask.id)
    if (error) { toast.error('Update failed'); setCompleting(false); return }
    setTasks(prev => prev.map(t => t.id === doneTask.id ? { ...t, status: 'done', rating, completion_note: note.trim() || null } : t))
    toast.success('Task marked as done!')
    setDoneTask(null); setRating(0); setNote('')
    setCompleting(false)
  }

  const filtered = tasks.filter(t => filterStatus === 'all' || t.status === filterStatus)
  const pending = tasks.filter(t => t.status !== 'done')
  const todayCount = pending.filter(t => isToday(t.due_date)).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HeartHandshake className="w-6 h-6 text-blue-600" /> Help & Support
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tasks assigned to you · {pending.length} pending
          {todayCount > 0 && <span className="text-amber-600 font-medium"> · {todayCount} due today</span>}
        </p>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'in_progress', 'done'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}>
            {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            <span className="ml-1 opacity-70">
              ({s === 'all' ? tasks.length : tasks.filter(t => t.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-white">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-sm">No tasks here</p>
          <p className="text-xs mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => {
            const urg = URGENCY_META[task.urgency]
            const due = task.due_date
            const overdue = isPast(due) && task.status !== 'done' && !isToday(due)
            const dueToday = isToday(due) && task.status !== 'done'
            return (
              <div key={task.id} className={`rounded-xl border p-4 bg-white transition-all ${
                dueToday ? 'border-amber-300 bg-amber-50' :
                overdue   ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                    task.urgency === 'urgent' ? 'bg-red-500' :
                    task.urgency === 'high'   ? 'bg-orange-400' :
                    task.urgency === 'medium' ? 'bg-blue-400' : 'bg-slate-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-semibold text-sm ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {task.title}
                      </p>
                      <Badge variant="outline" className={`text-[10px] gap-1 flex-shrink-0 ${urg.color}`}>
                        {urg.icon}{urg.label}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                      <span className={`flex items-center gap-1 font-medium ${
                        dueToday ? 'text-amber-600' : overdue ? 'text-red-600' : 'text-slate-500'
                      }`}>
                        <Calendar className="w-3 h-3" />
                        {dueToday ? 'Due Today!' : overdue ? `Overdue: ${fmtDate(due)}` : fmtDate(due)}
                      </span>
                      <span className="text-muted-foreground">from {task.created_by_name}</span>
                      {task.status === 'done' && task.rating && (
                        <span className="flex items-center gap-0.5 text-yellow-600">
                          {Array.from({ length: task.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                        </span>
                      )}
                    </div>
                    {task.completion_note && (
                      <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mt-2">
                        {task.completion_note}
                      </p>
                    )}
                    {task.status !== 'done' && (
                      <div className="flex gap-2 mt-3">
                        {task.status === 'pending' && (
                          <Button size="sm" variant="outline" onClick={() => startTask(task.id)}
                            className="h-7 text-xs gap-1 text-blue-700 border-blue-200 hover:bg-blue-50">
                            <Clock className="w-3 h-3" /> Start Working
                          </Button>
                        )}
                        <Button size="sm" onClick={() => { setDoneTask(task); setRating(0); setNote('') }}
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

      {/* Mark Done Dialog */}
      <Dialog open={!!doneTask} onOpenChange={open => !open && setDoneTask(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" /> Task Complete!
            </DialogTitle>
          </DialogHeader>
          {doneTask && (
            <div className="space-y-4 mt-1">
              <p className="text-sm font-medium text-slate-800">{doneTask.title}</p>
              <div>
                <Label className="text-xs mb-2">Rate your work (1-5 stars) *</Label>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div>
                <Label className="text-xs mb-1.5">Completion Note (optional)</Label>
                <Textarea placeholder="What did you do, any remarks…" rows={2} value={note}
                  onChange={e => setNote(e.target.value)} className="resize-none" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDoneTask(null)}>Cancel</Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={markDone} disabled={completing}>
                  {completing ? 'Saving…' : 'Submit'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

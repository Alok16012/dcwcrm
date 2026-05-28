'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  GraduationCap, BookOpen, ClipboardList, Star, CheckCircle2,
  Clock, XCircle, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react'
import { format } from 'date-fns'

interface AssignedStudent {
  id: string
  full_name: string
  enrollment_number: string | null
  phone: string
  course: { name: string } | null
  sub_section: { name: string } | null
  session: { name: string } | null
}

interface TaskDraft {
  work_assignment: { description: string; rating: string }
  practical: { description: string; rating: string }
  exam: { description: string; rating: string }
}

interface SubmittedTask {
  id: string
  task_type: string
  description: string | null
  rating: number | null
  status: string
  salary_percentage: number | null
  admin_remarks: string | null
  created_at: string
}

const TASK_TYPES = [
  { key: 'work_assignment', label: 'Work Assignment', color: 'blue' },
  { key: 'practical',       label: 'Practical',       color: 'emerald' },
  { key: 'exam',            label: 'Exam',             color: 'purple' },
] as const

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:  { label: 'Pending Approval', color: 'bg-amber-100 text-amber-800 border-amber-200',  icon: Clock },
  approved: { label: 'Approved',         color: 'bg-green-100 text-green-800 border-green-200',  icon: CheckCircle2 },
  rejected: { label: 'Rejected',         color: 'bg-red-100 text-red-800 border-red-200',        icon: XCircle },
}

const EMPTY_DRAFT: TaskDraft = {
  work_assignment: { description: '', rating: '' },
  practical:       { description: '', rating: '' },
  exam:            { description: '', rating: '' },
}

export default function MentorshipClient() {
  const [students, setStudents] = useState<AssignedStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [history, setHistory] = useState<Record<string, SubmittedTask[]>>({})
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({})

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('students')
        .select(`
          id, full_name, enrollment_number, phone,
          course:courses(name),
          sub_section:department_sub_sections(name),
          session:sessions(name)
        `)
        .eq('mentor_telecaller_id', user.id)
        .order('full_name')

      if (error) throw error
      setStudents((data ?? []) as AssignedStudent[])
    } catch (err) {
      toast.error('Failed to load assigned students')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function loadHistory(studentId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('student_mentorships')
      .select('id, task_type, description, rating, status, salary_percentage, admin_remarks, created_at')
      .eq('student_id', studentId)
      .eq('telecaller_id', user.id)
      .order('created_at', { ascending: false })
    setHistory(prev => ({ ...prev, [studentId]: (data ?? []) as SubmittedTask[] }))
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      if (!drafts[id]) setDrafts(prev => ({ ...prev, [id]: { ...EMPTY_DRAFT, work_assignment: { ...EMPTY_DRAFT.work_assignment }, practical: { ...EMPTY_DRAFT.practical }, exam: { ...EMPTY_DRAFT.exam } } }))
      loadHistory(id)
    }
  }

  function updateDraft(studentId: string, taskType: keyof TaskDraft, field: 'description' | 'rating', value: string) {
    setDrafts(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? EMPTY_DRAFT),
        [taskType]: {
          ...(prev[studentId]?.[taskType] ?? { description: '', rating: '' }),
          [field]: value,
        },
      },
    }))
  }

  async function submitTasks(studentId: string) {
    const draft = drafts[studentId]
    if (!draft) return

    const filled = TASK_TYPES
      .map(t => ({ task_type: t.key, ...draft[t.key] }))
      .filter(t => t.description.trim() || t.rating)

    if (filled.length === 0) {
      toast.error('Please fill at least one task before submitting')
      return
    }

    setSubmitting(studentId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const records = filled.map(t => ({
        student_id: studentId,
        telecaller_id: user.id,
        task_type: t.task_type,
        description: t.description.trim() || null,
        rating: t.rating ? parseFloat(t.rating) : null,
        status: 'pending',
        created_by: user.id,
      }))

      const { error } = await supabase.from('student_mentorships').insert(records as never)
      if (error) throw error

      toast.success('Work submitted for admin approval')
      // Reset draft for this student
      setDrafts(prev => ({ ...prev, [studentId]: { ...EMPTY_DRAFT, work_assignment: { description: '', rating: '' }, practical: { description: '', rating: '' }, exam: { description: '', rating: '' } } }))
      await loadHistory(studentId)
    } catch (err) {
      toast.error('Failed to submit')
      console.error(err)
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mentorship</h1>
          <p className="text-sm text-gray-500 mt-0.5">Students assigned to you for mentorship</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No students assigned</p>
          <p className="text-sm text-gray-400 mt-1">Admin will assign students to you for mentorship</p>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map(s => {
            const isExpanded = expandedId === s.id
            const draft = drafts[s.id] ?? EMPTY_DRAFT
            const taskHistory = history[s.id] ?? []
            const pendingCount = taskHistory.filter(t => t.status === 'pending').length

            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Student row */}
                <button
                  onClick={() => toggleExpand(s.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm flex-shrink-0">
                    {s.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 text-sm">{s.full_name}</p>
                      {s.enrollment_number && (
                        <span className="text-xs font-mono text-gray-400">#{s.enrollment_number}</span>
                      )}
                      {pendingCount > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                          {pendingCount} pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {s.course && <span className="text-xs text-gray-500">{s.course.name}</span>}
                      {s.sub_section && <span className="text-xs text-gray-400">· {s.sub_section.name}</span>}
                      {s.session && <span className="text-xs text-gray-400">· {s.session.name}</span>}
                      <span className="text-xs text-gray-400">· {s.phone}</span>
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  }
                </button>

                {/* Expanded work panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-5 bg-gray-50/50 space-y-5">
                    {/* Task forms */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5" /> Submit Work
                      </p>
                      <div className="space-y-3">
                        {TASK_TYPES.map(t => (
                          <div
                            key={t.key}
                            className={`rounded-xl p-4 border ${
                              t.color === 'blue'    ? 'bg-blue-50/60 border-blue-200' :
                              t.color === 'emerald' ? 'bg-emerald-50/60 border-emerald-200' :
                                                     'bg-purple-50/60 border-purple-200'
                            }`}
                          >
                            <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${
                              t.color === 'blue'    ? 'text-blue-600' :
                              t.color === 'emerald' ? 'text-emerald-600' :
                                                     'text-purple-600'
                            }`}>{t.label}</p>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2 space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-600">Work Description</Label>
                                <Textarea
                                  rows={2}
                                  placeholder="Describe the work done for this student..."
                                  value={draft[t.key].description}
                                  onChange={e => updateDraft(s.id, t.key, 'description', e.target.value)}
                                  className="bg-white text-sm resize-none"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                                  <Star className="w-3 h-3 text-amber-500" /> Rating (0–10)
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.5"
                                  placeholder="e.g. 8"
                                  value={draft[t.key].rating}
                                  onChange={e => updateDraft(s.id, t.key, 'rating', e.target.value)}
                                  className="bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end mt-3">
                        <Button
                          onClick={() => submitTasks(s.id)}
                          disabled={submitting === s.id}
                          className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                        >
                          {submitting === s.id
                            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                            : 'Submit for Approval'
                          }
                        </Button>
                      </div>
                    </div>

                    {/* History */}
                    {taskHistory.length > 0 && (
                      <div>
                        <button
                          onClick={() => setShowHistory(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 mb-2"
                        >
                          {showHistory[s.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          Submission History ({taskHistory.length})
                        </button>
                        {showHistory[s.id] && (
                          <div className="space-y-2">
                            {taskHistory.map(m => {
                              const cfg = STATUS_CFG[m.status] ?? STATUS_CFG.pending
                              const Icon = cfg.icon
                              return (
                                <div key={m.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                      <span className="text-xs font-bold text-gray-700">
                                        {TASK_TYPES.find(t => t.key === m.task_type)?.label ?? m.task_type}
                                      </span>
                                      {m.rating != null && (
                                        <span className="flex items-center gap-0.5 text-xs text-amber-600 font-semibold">
                                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{m.rating}/10
                                        </span>
                                      )}
                                      <span className="text-xs text-gray-400">{format(new Date(m.created_at), 'dd MMM yyyy')}</span>
                                    </div>
                                    {m.description && <p className="text-xs text-gray-500">{m.description}</p>}
                                    {m.status === 'approved' && m.salary_percentage != null && (
                                      <p className="text-xs text-green-600 font-semibold mt-0.5">+{m.salary_percentage}% salary bonus</p>
                                    )}
                                    {m.admin_remarks && <p className="text-xs text-gray-400 italic mt-0.5">"{m.admin_remarks}"</p>}
                                  </div>
                                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${cfg.color}`}>
                                    <Icon className="w-3 h-3" /> {cfg.label}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlus, Users, Search, X, Zap, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { lmsDb, fmtDateTime, pct } from '@/lib/lms/shared'
import { inputCls, EmptyState } from '../form'
import { cn } from '@/lib/utils'

export interface StudentRow {
  id: string
  full_name: string
  enrollment_number: string
  phone: string
  course_id: string | null
  sub_course_id: string | null
  portal_user_id: string | null
  status: string
  course: { name: string } | null
  sub_course: { name: string } | null
}

export type Learner = StudentRow & {
  source: 'manual' | 'auto'
  enrolled_at: string | null
  completed: number
  attempts: number
  best_pct: number | null
  last_active: string | null
}

function fmtEnroll(n: string) {
  return n.startsWith('ENR-') ? 'DCW-' + n.slice(4).replace(/[^0-9]/g, '') : n
}

export function StudentsTab({ courseId, learners, students, publishedLessons, crmCourses }: {
  courseId: string
  learners: Learner[]
  students: StudentRow[]
  publishedLessons: number
  crmCourses: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [toRemove, setToRemove] = useState<Learner | null>(null)

  const visible = learners.filter(l => {
    const q = query.trim().toLowerCase()
    return !q || l.full_name.toLowerCase().includes(q) || l.phone.includes(q) || fmtEnroll(l.enrollment_number).toLowerCase().includes(q)
  })
  const noPortal = learners.filter(l => !l.portal_user_id).length
  const avg = learners.length ? Math.round(learners.reduce((n, l) => n + pct(l.completed, publishedLessons), 0) / learners.length) : 0

  async function remove() {
    if (!toRemove) return
    const { error } = await lmsDb(createClient()).from('lms_enrollments').delete().eq('course_id', courseId).eq('student_id', toRemove.id)
    setToRemove(null)
    if (error) { toast.error(error.message); return }
    toast.success('Student removed from course')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className={cn(inputCls, 'pl-9')} placeholder="Search name, phone, enrollment no…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <p className="text-xs text-gray-500">{learners.length} learners · avg completion {avg}%</p>
        <Button onClick={() => setOpen(true)} className="ml-auto bg-blue-600 hover:bg-blue-700 gap-1.5">
          <UserPlus className="h-4 w-4" /> Enroll students
        </Button>
      </div>

      {noPortal > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{noPortal} learner{noPortal > 1 ? 's have' : ' has'} no student portal login yet, so they can&apos;t open the course. Create logins from <b>Student Portal</b>.</span>
        </div>
      )}

      {learners.length === 0 ? (
        <EmptyState icon={Users} title="No learners yet" hint="Enroll students, or link this course to a CRM course with auto-enroll." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left font-semibold px-4 py-2.5">Student</th>
                <th className="text-left font-semibold px-3 py-2.5">Access</th>
                <th className="text-left font-semibold px-3 py-2.5 min-w-[160px]">Progress</th>
                <th className="text-left font-semibold px-3 py-2.5">Tests</th>
                <th className="text-left font-semibold px-3 py-2.5">Last active</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map(l => {
                const p = pct(l.completed, publishedLessons)
                return (
                  <tr key={l.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{l.full_name}</p>
                      <p className="text-[11px] text-gray-500">{fmtEnroll(l.enrollment_number)} · {l.phone}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5',
                        l.source === 'auto' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700')}>
                        {l.source === 'auto' && <Zap className="h-3 w-3" />}{l.source === 'auto' ? 'Auto' : 'Enrolled'}
                      </span>
                      {!l.portal_user_id && <p className="text-[10px] text-amber-600 mt-0.5">No portal login</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                          <div className={cn('h-full rounded-full', p === 100 ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${p}%` }} />
                        </div>
                        <span className="text-xs text-gray-600 w-16 text-right">{l.completed}/{publishedLessons} · {p}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">
                      {l.attempts ? <>{l.attempts} taken · best {l.best_pct}%</> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{l.last_active ? fmtDateTime(l.last_active) : '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      {l.source === 'manual' && (
                        <button onClick={() => setToRemove(l)} className="h-7 w-7 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label="Remove from course">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <EnrollDialog open={open} onOpenChange={setOpen} courseId={courseId} students={students}
        enrolled={new Set(learners.map(l => l.id))} crmCourses={crmCourses} />

      <ConfirmDialog open={!!toRemove} onCancel={() => setToRemove(null)} onConfirm={remove} destructive confirmLabel="Remove"
        title="Remove from course?" description={toRemove ? `${toRemove.full_name} will lose access. Their progress is kept if you enroll them again.` : ''} />
    </div>
  )
}

function EnrollDialog({ open, onOpenChange, courseId, students, enrolled, crmCourses }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  courseId: string
  students: StudentRow[]
  enrolled: Set<string>
  crmCourses: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [crmCourse, setCrmCourse] = useState('')
  const [onlyPortal, setOnlyPortal] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const candidates = useMemo(() => students.filter(s => {
    if (enrolled.has(s.id)) return false
    if (crmCourse && s.course_id !== crmCourse) return false
    if (onlyPortal && !s.portal_user_id) return false
    const q = query.trim().toLowerCase()
    return !q || s.full_name.toLowerCase().includes(q) || s.phone.includes(q) || fmtEnroll(s.enrollment_number).toLowerCase().includes(q)
  }), [students, enrolled, crmCourse, onlyPortal, query])

  const shown = candidates.slice(0, 200)
  const allShownPicked = shown.length > 0 && shown.every(s => picked.has(s.id))

  function toggle(id: string) {
    setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function enroll() {
    if (picked.size === 0) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const rows = [...picked].map(student_id => ({ student_id, course_id: courseId, enrolled_by: user?.id ?? null }))
    const { error } = await lmsDb(supabase).from('lms_enrollments').upsert(rows, { onConflict: 'student_id,course_id', ignoreDuplicates: true })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(`${rows.length} student${rows.length > 1 ? 's' : ''} enrolled`)
    setPicked(new Set())
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>Enroll students</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input className={cn(inputCls, 'pl-9')} autoFocus placeholder="Search students…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <select className={cn(inputCls, 'w-44')} value={crmCourse} onChange={e => setCrmCourse(e.target.value)}>
            <option value="">All CRM courses</option>
            {crmCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={onlyPortal} onChange={e => setOnlyPortal(e.target.checked)} />
            Has portal login
          </label>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={allShownPicked} disabled={shown.length === 0}
              onChange={() => setPicked(p => {
                const n = new Set(p)
                shown.forEach(s => { if (allShownPicked) n.delete(s.id); else n.add(s.id) })
                return n
              })} />
            Select all shown ({shown.length}{candidates.length > shown.length ? ` of ${candidates.length} — refine search` : ''})
          </label>
          <span>{picked.size} selected</span>
        </div>

        <div className="flex-1 min-h-[200px] overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
          {shown.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No students to add.</p>
          ) : shown.map(s => (
            <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{s.full_name}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {fmtEnroll(s.enrollment_number)} · {s.phone}{s.course?.name ? ` · ${s.course.name}` : ''}{s.sub_course?.name ? ` / ${s.sub_course.name}` : ''}
                </p>
              </div>
              {!s.portal_user_id && <span className="text-[10px] text-amber-600 shrink-0">no login</span>}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={enroll} disabled={saving || picked.size === 0} className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Enrolling…' : `Enroll ${picked.size || ''}`.trim()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'
import { useState, useTransition, useRef } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, BookOpen, GraduationCap, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface SubCourseRow { id: string; name: string; is_active: boolean; course_id: string }
interface CourseRow { id: string; name: string; is_active: boolean; sub_courses: SubCourseRow[] }

function InlineEdit({ value, onSave, onCancel, placeholder }: {
  value: string; onSave: (v: string) => void; onCancel: () => void; placeholder?: string
}) {
  const [text, setText] = useState(value)
  return (
    <div className="flex items-center gap-2 flex-1">
      <Input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(text); if (e.key === 'Escape') onCancel() }}
        placeholder={placeholder}
        className="h-8 text-sm border-blue-300 focus:border-blue-500"
      />
      <button onClick={() => onSave(text)} className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 flex-shrink-0">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={onCancel} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// Multi-row sub-course adder
function AddStandardsPanel({ courseId, onSave, onCancel, saving }: {
  courseId: string
  onSave: (names: string[]) => void
  onCancel: () => void
  saving: boolean
}) {
  const [rows, setRows] = useState<string[]>([''])
  const lastInputRef = useRef<HTMLInputElement>(null)

  function updateRow(i: number, val: string) {
    setRows((prev) => prev.map((r, idx) => idx === i ? val : r))
  }

  function addRow() {
    setRows((prev) => [...prev, ''])
    setTimeout(() => lastInputRef.current?.focus(), 50)
  }

  function removeRow(i: number) {
    if (rows.length === 1) { setRows(['']); return }
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'Enter') { e.preventDefault(); addRow() }
    if (e.key === 'Escape') onCancel()
  }

  function handleSave() {
    const names = rows.map((r) => r.trim()).filter(Boolean)
    if (!names.length) { onCancel(); return }
    onSave(names)
  }

  return (
    <div className="border-t border-emerald-200 bg-emerald-50/40 px-4 py-3 space-y-2">
      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <GraduationCap className="w-3.5 h-3.5" /> Standards add karo
        <span className="text-emerald-500 font-normal normal-case">(Enter dabao nayi row ke liye)</span>
      </p>

      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-emerald-500 font-bold w-5 text-right flex-shrink-0">{i + 1}.</span>
            <Input
              ref={i === rows.length - 1 ? lastInputRef : undefined}
              value={row}
              onChange={(e) => updateRow(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              placeholder={`Standard ${i + 1} ka naam...`}
              className="h-8 text-sm bg-white border-emerald-200 focus:border-emerald-400"
              autoFocus={i === 0}
            />
            <button
              onClick={() => removeRow(i)}
              className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 font-medium mt-1 px-1"
      >
        <Plus className="w-3.5 h-3.5" /> Aur ek add karo
      </button>

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || rows.every((r) => !r.trim())}
          className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs px-4"
        >
          {saving ? 'Saving...' : `Save ${rows.filter((r) => r.trim()).length} Standard${rows.filter((r) => r.trim()).length !== 1 ? 's' : ''}`}
        </Button>
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2">
          Cancel
        </button>
      </div>
    </div>
  )
}

export function CoursesClient({ courses: initial }: { courses: CourseRow[] }) {
  const [courses, setCourses] = useState(initial)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingCourse, setEditingCourse] = useState<string | null>(null)
  const [editingSub, setEditingSub] = useState<string | null>(null)
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null)
  const [addingCourse, setAddingCourse] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'course' | 'sub'; id: string; name: string; courseId?: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  function toggleExpand(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function saveCourse(id: string, name: string) {
    if (!name.trim()) return
    startTransition(async () => {
      const { error } = await supabase.from('courses').update({ name: name.trim() } as never).eq('id', id)
      if (error) { toast.error('Failed to update'); return }
      setCourses((prev) => prev.map((c) => c.id === id ? { ...c, name: name.trim() } : c))
      setEditingCourse(null)
      toast.success('Course updated')
    })
  }

  async function addCourse(name: string) {
    if (!name.trim()) { setAddingCourse(false); return }
    startTransition(async () => {
      const { data, error } = await supabase.from('courses').insert({ name: name.trim() } as never).select().single()
      if (error) { toast.error(error.message); return }
      setCourses((prev) => [...prev, { ...(data as any), sub_courses: [] }])
      setAddingCourse(false)
      toast.success('Course added!')
    })
  }

  async function deleteCourse(id: string) {
    startTransition(async () => {
      const { error } = await supabase.from('courses').delete().eq('id', id)
      if (error) { toast.error('Failed to delete'); return }
      setCourses((prev) => prev.filter((c) => c.id !== id))
      toast.success('Course deleted')
    })
    setDeleteTarget(null)
  }

  async function saveSub(courseId: string, subId: string, name: string) {
    if (!name.trim()) return
    startTransition(async () => {
      const { error } = await supabase.from('sub_courses').update({ name: name.trim() } as never).eq('id', subId)
      if (error) { toast.error('Failed to update'); return }
      setCourses((prev) => prev.map((c) => c.id === courseId
        ? { ...c, sub_courses: c.sub_courses.map((s) => s.id === subId ? { ...s, name: name.trim() } : s) }
        : c
      ))
      setEditingSub(null)
      toast.success('Standard updated')
    })
  }

  // Save MULTIPLE sub-courses at once
  async function addMultipleSubs(courseId: string, names: string[]) {
    startTransition(async () => {
      const rows = names.map((name) => ({ name, course_id: courseId }))
      const { data, error } = await supabase.from('sub_courses').insert(rows as never).select()
      if (error) { toast.error(error.message); return }
      setCourses((prev) => prev.map((c) => c.id === courseId
        ? { ...c, sub_courses: [...c.sub_courses, ...(data ?? [])] }
        : c
      ))
      setAddingSubTo(null)
      setExpanded((prev) => new Set(prev).add(courseId))
      toast.success(`${names.length} standard${names.length > 1 ? 's' : ''} add ho gaye!`)
    })
  }

  async function deleteSub(courseId: string, subId: string) {
    startTransition(async () => {
      const { error } = await supabase.from('sub_courses').delete().eq('id', subId)
      if (error) { toast.error('Failed to delete'); return }
      setCourses((prev) => prev.map((c) => c.id === courseId
        ? { ...c, sub_courses: c.sub_courses.filter((s) => s.id !== subId) }
        : c
      ))
      toast.success('Standard deleted')
    })
    setDeleteTarget(null)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Courses & Standards</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage courses and standards offered by your consultancy</p>
        </div>
        <Button onClick={() => setAddingCourse(true)} disabled={addingCourse} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Course
        </Button>
      </div>

      {addingCourse && (
        <div className="bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl p-4 mb-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <InlineEdit
            value=""
            placeholder="Course name e.g. IELTS, MBA, B.Tech..."
            onSave={addCourse}
            onCancel={() => setAddingCourse(false)}
          />
        </div>
      )}

      {courses.length === 0 && !addingCourse && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No courses yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first course to get started</p>
          <Button className="mt-4 gap-1.5" onClick={() => setAddingCourse(true)}>
            <Plus className="w-4 h-4" /> Add Course
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {courses.map((course) => (
          <div key={course.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Course row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => toggleExpand(course.id)}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0 transition-colors"
              >
                {expanded.has(course.id)
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />}
              </button>

              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4 text-blue-600" />
              </div>

              {editingCourse === course.id ? (
                <InlineEdit
                  value={course.name}
                  placeholder="Course name"
                  onSave={(v) => saveCourse(course.id, v)}
                  onCancel={() => setEditingCourse(null)}
                />
              ) : (
                <>
                  <span className="font-semibold text-gray-800 flex-1">{course.name}</span>
                  <Badge variant="outline" className="text-xs text-gray-500 border-gray-200 mr-1">
                    {course.sub_courses.length} standard{course.sub_courses.length !== 1 ? 's' : ''}
                  </Badge>
                  <button
                    onClick={() => { setAddingSubTo(course.id); setExpanded((p) => new Set(p).add(course.id)) }}
                    title="Add standards"
                    className="w-7 h-7 rounded-lg hover:bg-emerald-50 text-emerald-600 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingCourse(course.id)}
                    className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 flex items-center justify-center transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ type: 'course', id: course.id, name: course.name })}
                    className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-400 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Sub-courses panel */}
            {expanded.has(course.id) && (
              <div className="border-t border-gray-100">
                {/* Multi-add panel */}
                {addingSubTo === course.id && (
                  <AddStandardsPanel
                    courseId={course.id}
                    saving={isPending}
                    onSave={(names) => addMultipleSubs(course.id, names)}
                    onCancel={() => setAddingSubTo(null)}
                  />
                )}

                {course.sub_courses.length === 0 && addingSubTo !== course.id && (
                  <div className="px-16 py-3 text-xs text-gray-400 flex items-center gap-2 bg-gray-50/60">
                    <GraduationCap className="w-3.5 h-3.5" />
                    No standards yet —
                    <button onClick={() => setAddingSubTo(course.id)} className="text-emerald-600 hover:underline font-medium">
                      add karo
                    </button>
                  </div>
                )}

                {course.sub_courses.length > 0 && (
                  <div className="bg-gray-50/60 divide-y divide-gray-100">
                    {course.sub_courses.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5 group">
                        <div className="w-6 flex-shrink-0" />
                        <div className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center flex-shrink-0 ml-7">
                          <GraduationCap className="w-3 h-3 text-emerald-600" />
                        </div>

                        {editingSub === sub.id ? (
                          <InlineEdit
                            value={sub.name}
                            placeholder="Standard name"
                            onSave={(v) => saveSub(course.id, sub.id, v)}
                            onCancel={() => setEditingSub(null)}
                          />
                        ) : (
                          <>
                            <span className="text-sm text-gray-700 flex-1">{sub.name}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingSub(sub.id)}
                                className="w-6 h-6 rounded-md hover:bg-blue-100 text-blue-500 flex items-center justify-center"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ type: 'sub', id: sub.id, name: sub.name, courseId: course.id })}
                                className="w-6 h-6 rounded-md hover:bg-red-100 text-red-400 flex items-center justify-center"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title={`Delete ${deleteTarget.type === 'course' ? 'Course' : 'Standard'}`}
          description={`"${deleteTarget.name}" permanently delete ho jaayega. Kya aap sure hain?`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => deleteTarget.type === 'course'
            ? deleteCourse(deleteTarget.id)
            : deleteSub(deleteTarget.courseId!, deleteTarget.id)
          }
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

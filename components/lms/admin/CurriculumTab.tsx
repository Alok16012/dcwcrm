'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Layers, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { lmsDb, LESSON_TYPES, videoEmbedUrl, isDirectVideo, type LessonType, type LmsLesson, type LmsModule, type LmsTest } from '@/lib/lms/shared'
import { Field, inputCls, textareaCls, EmptyState } from '../form'
import { LmsUploadButton } from '../LmsUploadButton'
import { cn } from '@/lib/utils'

type Delete = { kind: 'module' | 'lesson'; id: string; title: string }

export function CurriculumTab({ courseId, modules, lessons, tests }: {
  courseId: string
  modules: LmsModule[]
  lessons: LmsLesson[]
  tests: Pick<LmsTest, 'id' | 'title' | 'status'>[]
}) {
  const router = useRouter()
  const [moduleDialog, setModuleDialog] = useState<{ open: boolean; module?: LmsModule }>({ open: false })
  const [lessonDialog, setLessonDialog] = useState<{ open: boolean; moduleId?: string; lesson?: LmsLesson }>({ open: false })
  const [toDelete, setToDelete] = useState<Delete | null>(null)

  const byModule = (moduleId: string) => lessons.filter(l => l.module_id === moduleId).sort((a, b) => a.sort_order - b.sort_order)

  async function move(table: 'lms_modules' | 'lms_lessons', list: { id: string; sort_order: number }[], index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= list.length) return
    const order = list.map(x => x.id)
    ;[order[index], order[target]] = [order[target]!, order[index]!]
    // Renumber the whole list so stale or duplicate sort_orders can't fight the swap.
    const db = lmsDb(createClient())
    const updates = order
      .map((id, i) => ({ id, i }))
      .filter(({ id, i }) => list.find(x => x.id === id)?.sort_order !== i)
      .map(({ id, i }) => db.from(table).update({ sort_order: i }).eq('id', id))
    const results = await Promise.all(updates)
    const failed = results.find(r => r.error)
    if (failed?.error) { toast.error(failed.error.message); return }
    router.refresh()
  }

  async function togglePublish(l: LmsLesson) {
    const { error } = await lmsDb(createClient()).from('lms_lessons').update({ is_published: !l.is_published }).eq('id', l.id)
    if (error) { toast.error(error.message); return }
    toast.success(l.is_published ? 'Lesson hidden from students' : 'Lesson visible to students')
    router.refresh()
  }

  async function remove() {
    if (!toDelete) return
    const table = toDelete.kind === 'module' ? 'lms_modules' : 'lms_lessons'
    const { error } = await lmsDb(createClient()).from(table).delete().eq('id', toDelete.id)
    setToDelete(null)
    if (error) { toast.error(error.message); return }
    toast.success(`${toDelete.kind === 'module' ? 'Module' : 'Lesson'} deleted`)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <p className="text-sm text-gray-500">{modules.length} modules · {lessons.length} lessons</p>
        <Button onClick={() => setModuleDialog({ open: true })} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
          <Plus className="h-4 w-4" /> Add module
        </Button>
      </div>

      {modules.length === 0 ? (
        <EmptyState icon={Layers} title="No modules yet" hint="Modules group lessons — e.g. one module per subject or unit." />
      ) : modules.map((m, mi) => {
        const items = byModule(m.id)
        return (
          <div key={m.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50/70 border-b border-gray-100">
              <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900">Module {mi + 1}: {m.title}</p>
                {m.description && <p className="text-xs text-gray-500 truncate">{m.description}</p>}
              </div>
              <IconBtn label="Move up" disabled={mi === 0} onClick={() => move('lms_modules', modules, mi, -1)}><ChevronUp className="h-4 w-4" /></IconBtn>
              <IconBtn label="Move down" disabled={mi === modules.length - 1} onClick={() => move('lms_modules', modules, mi, 1)}><ChevronDown className="h-4 w-4" /></IconBtn>
              <IconBtn label="Edit module" onClick={() => setModuleDialog({ open: true, module: m })}><Pencil className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn label="Delete module" danger onClick={() => setToDelete({ kind: 'module', id: m.id, title: m.title })}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
            </div>

            <div className="divide-y divide-gray-50">
              {items.map((l, li) => {
                const meta = LESSON_TYPES[l.type]
                return (
                  <div key={l.id} className={cn('flex items-center gap-3 px-4 py-2.5', !l.is_published && 'opacity-60')}>
                    <span className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', meta.bg, meta.color)}>
                      <meta.icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{l.title}</p>
                      <p className="text-[11px] text-gray-400">
                        {meta.label}{l.duration_min ? ` · ${l.duration_min} min` : ''}{!l.is_published ? ' · hidden' : ''}
                        {l.type === 'test' && l.test_id && ` · ${tests.find(t => t.id === l.test_id)?.title ?? 'test'}`}
                      </p>
                    </div>
                    <IconBtn label="Move up" disabled={li === 0} onClick={() => move('lms_lessons', items, li, -1)}><ChevronUp className="h-4 w-4" /></IconBtn>
                    <IconBtn label="Move down" disabled={li === items.length - 1} onClick={() => move('lms_lessons', items, li, 1)}><ChevronDown className="h-4 w-4" /></IconBtn>
                    <IconBtn label={l.is_published ? 'Hide from students' : 'Show to students'} onClick={() => togglePublish(l)}>
                      {l.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </IconBtn>
                    <IconBtn label="Edit lesson" onClick={() => setLessonDialog({ open: true, moduleId: m.id, lesson: l })}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn label="Delete lesson" danger onClick={() => setToDelete({ kind: 'lesson', id: l.id, title: l.title })}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                )
              })}
              <button onClick={() => setLessonDialog({ open: true, moduleId: m.id })}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-blue-600 hover:bg-blue-50/50">
                <Plus className="h-3.5 w-3.5" /> Add lesson
              </button>
            </div>
          </div>
        )
      })}

      <ModuleDialog key={moduleDialog.open ? (moduleDialog.module?.id ?? "new") : "closed"} courseId={courseId} nextOrder={modules.length} state={moduleDialog} onClose={() => setModuleDialog({ open: false })} />
      <LessonDialog key={lessonDialog.open ? (lessonDialog.lesson?.id ?? `new-${lessonDialog.moduleId}`) : "closed"} courseId={courseId} tests={tests} state={lessonDialog}
        nextOrder={lessonDialog.moduleId ? byModule(lessonDialog.moduleId).length : 0}
        onClose={() => setLessonDialog({ open: false })} />
      <ConfirmDialog
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={remove}
        destructive
        confirmLabel="Delete"
        title={toDelete?.kind === 'module' ? 'Delete module?' : 'Delete lesson?'}
        description={toDelete ? (toDelete.kind === 'module'
          ? `"${toDelete.title}" and all its lessons (and student progress on them) will be deleted.`
          : `"${toDelete.title}" and student progress on it will be deleted.`) : ''}
      />
    </div>
  )
}

function IconBtn({ label, onClick, disabled, danger, children }: {
  label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode
}) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick}
      className={cn('h-7 w-7 rounded-md flex items-center justify-center text-gray-400 disabled:opacity-30 disabled:pointer-events-none',
        danger ? 'hover:text-red-600 hover:bg-red-50' : 'hover:text-gray-700 hover:bg-gray-100')}>
      {children}
    </button>
  )
}

function ModuleDialog({ courseId, nextOrder, state, onClose }: {
  courseId: string; nextOrder: number; state: { open: boolean; module?: LmsModule }; onClose: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState(state.module?.title ?? '')
  const [description, setDescription] = useState(state.module?.description ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) { toast.error('Module title is required'); return }
    setSaving(true)
    const db = lmsDb(createClient())
    const payload = { title: title.trim(), description: description.trim() }
    const { error } = state.module
      ? await db.from('lms_modules').update(payload).eq('id', state.module.id)
      : await db.from('lms_modules').insert({ ...payload, course_id: courseId, sort_order: nextOrder })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(state.module ? 'Module updated' : 'Module added')
    onClose()
    router.refresh()
  }

  return (
    <Dialog open={state.open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{state.module ? 'Edit module' : 'Add module'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Module title">
            <input className={inputCls} autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Unit 1 — Introduction" />
          </Field>
          <Field label="Description (optional)">
            <textarea className={textareaCls} rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const EMPTY_LESSON = { title: '', type: 'video' as LessonType, video_url: '', file_url: '', body: '', test_id: '', duration_min: '', is_published: true }

function LessonDialog({ courseId, tests, nextOrder, state, onClose }: {
  courseId: string
  tests: Pick<LmsTest, 'id' | 'title' | 'status'>[]
  nextOrder: number
  state: { open: boolean; moduleId?: string; lesson?: LmsLesson }
  onClose: () => void
}) {
  const router = useRouter()
  const [f, setF] = useState(() => {
    const l = state.lesson
    return l ? {
      title: l.title, type: l.type, video_url: l.video_url ?? '', file_url: l.file_url ?? '', body: l.body,
      test_id: l.test_id ?? '', duration_min: l.duration_min ? String(l.duration_min) : '', is_published: l.is_published,
    } : EMPTY_LESSON
  })
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }))

  async function save() {
    if (!f.title.trim()) { toast.error('Lesson title is required'); return }
    if (f.type === 'video' && !f.video_url.trim()) { toast.error('Add a video link or upload a video'); return }
    if (f.type === 'pdf' && !f.file_url.trim()) { toast.error('Add a file link or upload a file'); return }
    if (f.type === 'link' && !f.file_url.trim()) { toast.error('Add the link URL'); return }
    if (f.type === 'test' && !f.test_id) { toast.error('Choose a test'); return }
    if (f.type === 'text' && !f.body.trim()) { toast.error('Write the notes for this lesson'); return }
    setSaving(true)
    const payload = {
      title: f.title.trim(),
      type: f.type,
      video_url: f.type === 'video' ? f.video_url.trim() : null,
      file_url: f.type === 'pdf' || f.type === 'link' ? f.file_url.trim() : null,
      body: f.body.trim(),
      test_id: f.type === 'test' ? f.test_id : null,
      duration_min: Math.max(0, parseInt(f.duration_min || '0', 10) || 0),
      is_published: f.is_published,
    }
    const db = lmsDb(createClient())
    const { error } = state.lesson
      ? await db.from('lms_lessons').update(payload).eq('id', state.lesson.id)
      : await db.from('lms_lessons').insert({ ...payload, course_id: courseId, module_id: state.moduleId, sort_order: nextOrder })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(state.lesson ? 'Lesson updated' : 'Lesson added')
    onClose()
    router.refresh()
  }

  const videoOk = !f.video_url || !!videoEmbedUrl(f.video_url) || isDirectVideo(f.video_url)

  return (
    <Dialog open={state.open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{state.lesson ? 'Edit lesson' : 'Add lesson'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Lesson type">
            <div className="grid grid-cols-5 gap-1.5">
              {(Object.keys(LESSON_TYPES) as LessonType[]).map(t => {
                const meta = LESSON_TYPES[t]
                return (
                  <button key={t} type="button" onClick={() => set('type', t)}
                    className={cn('flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] font-medium',
                      f.type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                    <meta.icon className="h-4 w-4" />{meta.label}
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="Title">
            <input className={inputCls} value={f.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Chapter 1 — Lecture" />
          </Field>

          {f.type === 'video' && (
            <Field label="Video" hint={videoOk ? 'YouTube, Vimeo or Google Drive link, or upload an MP4 (max 50 MB).' : 'This link can\'t be embedded — students will get an "open video" button instead.'}>
              <div className="flex gap-2">
                <input className={inputCls} value={f.video_url} onChange={e => set('video_url', e.target.value)} placeholder="https://youtu.be/…" />
                <LmsUploadButton accept="video/mp4,video/webm" label="Upload" folder="videos" onUploaded={url => set('video_url', url)} />
              </div>
            </Field>
          )}
          {f.type === 'pdf' && (
            <Field label="File" hint="PDF, Word, PowerPoint or image — paste a link or upload (max 50 MB).">
              <div className="flex gap-2">
                <input className={inputCls} value={f.file_url} onChange={e => set('file_url', e.target.value)} placeholder="https://…/notes.pdf" />
                <LmsUploadButton accept=".pdf,.doc,.docx,.ppt,.pptx,image/*" label="Upload" folder="files" onUploaded={url => set('file_url', url)} />
              </div>
            </Field>
          )}
          {f.type === 'link' && (
            <Field label="Link URL">
              <input className={inputCls} value={f.file_url} onChange={e => set('file_url', e.target.value)} placeholder="https://…" />
            </Field>
          )}
          {f.type === 'test' && (
            <Field label="Test" hint={tests.length === 0 ? 'Create a test in the Tests tab first.' : 'Only published tests are visible to students.'}>
              <select className={inputCls} value={f.test_id} onChange={e => set('test_id', e.target.value)}>
                <option value="">— Choose test —</option>
                {tests.map(t => <option key={t.id} value={t.id}>{t.title}{t.status !== 'published' ? ' (draft)' : ''}</option>)}
              </select>
            </Field>
          )}

          <Field label={f.type === 'text' ? 'Notes' : 'Notes / description (optional)'}>
            <textarea className={textareaCls} rows={f.type === 'text' ? 8 : 3} value={f.body} onChange={e => set('body', e.target.value)}
              placeholder="Key points, instructions or the full lesson text…" />
          </Field>

          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Duration (minutes)">
              <input className={inputCls} type="number" min={0} value={f.duration_min} onChange={e => set('duration_min', e.target.value)} placeholder="0" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700 h-9">
              <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={f.is_published} onChange={e => set('is_published', e.target.checked)} />
              Visible to students
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : 'Save lesson'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { lmsDb, type LmsCourse, type CourseStatus } from '@/lib/lms/shared'
import { Field, inputCls, textareaCls } from './form'
import { LmsUploadButton } from './LmsUploadButton'

export interface CrmCourseOption { id: string; name: string; sub_courses: { id: string; name: string }[] }

const EMPTY = {
  title: '', description: '', thumbnail_url: '', crm_course_id: '', crm_sub_course_id: '',
  auto_enroll: false, status: 'draft' as CourseStatus,
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  course?: LmsCourse | null
  crmCourses: CrmCourseOption[]
}

export function CourseFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Mounted per open, so the form always starts from the current course. */}
        {props.open && <CourseForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function CourseForm({ onOpenChange, course, crmCourses }: Props) {
  const router = useRouter()
  const [form, setForm] = useState(() => course ? {
    title: course.title,
    description: course.description,
    thumbnail_url: course.thumbnail_url ?? '',
    crm_course_id: course.crm_course_id ?? '',
    crm_sub_course_id: course.crm_sub_course_id ?? '',
    auto_enroll: course.auto_enroll,
    status: course.status,
  } : EMPTY)
  const [saving, setSaving] = useState(false)

  const subCourses = crmCourses.find(c => c.id === form.crm_course_id)?.sub_courses ?? []

  async function save() {
    if (!form.title.trim()) { toast.error('Course title is required'); return }
    setSaving(true)
    const db = lmsDb(createClient())
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      thumbnail_url: form.thumbnail_url.trim() || null,
      crm_course_id: form.crm_course_id || null,
      crm_sub_course_id: form.crm_course_id ? (form.crm_sub_course_id || null) : null,
      auto_enroll: !!form.crm_course_id && form.auto_enroll,
      status: form.status,
    }
    if (course) {
      const { error } = await db.from('lms_courses').update(payload).eq('id', course.id)
      setSaving(false)
      if (error) { toast.error(error.message); return }
      toast.success('Course updated')
      onOpenChange(false)
      router.refresh()
    } else {
      const { data: { user } } = await createClient().auth.getUser()
      const { data, error } = await db.from('lms_courses').insert({ ...payload, created_by: user?.id ?? null }).select('id').single()
      setSaving(false)
      if (error) { toast.error(error.message); return }
      toast.success('Course created — now add modules and lessons')
      onOpenChange(false)
      router.push(`/lms/courses/${data.id}`)
    }
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>{course ? 'Edit course' : 'New LMS course'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Course title">
            <input className={inputCls} value={form.title} autoFocus
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. BA 1st Year — Hindi Literature" />
          </Field>
          <Field label="Description">
            <textarea className={textareaCls} rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What students will learn" />
          </Field>
          <Field label="Thumbnail image" hint="Paste an image URL or upload one.">
            <div className="flex gap-2">
              <input className={inputCls} value={form.thumbnail_url}
                onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))} placeholder="https://…" />
              <LmsUploadButton accept="image/*" maxSizeMB={5} label="Upload" folder="thumbnails"
                onUploaded={url => setForm(f => ({ ...f, thumbnail_url: url }))} />
            </div>
          </Field>

          <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-700">Link to CRM admission course (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Course">
                <select className={inputCls} value={form.crm_course_id}
                  onChange={e => setForm(f => ({ ...f, crm_course_id: e.target.value, crm_sub_course_id: '' }))}>
                  <option value="">— Not linked —</option>
                  {crmCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Sub-course">
                <select className={inputCls} value={form.crm_sub_course_id} disabled={!form.crm_course_id}
                  onChange={e => setForm(f => ({ ...f, crm_sub_course_id: e.target.value }))}>
                  <option value="">All sub-courses</option>
                  {subCourses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-blue-600" disabled={!form.crm_course_id}
                checked={form.auto_enroll && !!form.crm_course_id}
                onChange={e => setForm(f => ({ ...f, auto_enroll: e.target.checked }))} />
              <span>Auto-enroll: every student admitted to this course gets access automatically (no manual enrollment needed).</span>
            </label>
          </div>

          <Field label="Status" hint="Students only see published courses.">
            <select className={inputCls} value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as CourseStatus }))}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Saving…' : course ? 'Save changes' : 'Create course'}
          </Button>
        </div>
    </>
  )
}

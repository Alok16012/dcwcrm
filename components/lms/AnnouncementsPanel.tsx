'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Megaphone, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { lmsDb, fmtDateTime, type LmsAnnouncement } from '@/lib/lms/shared'
import { Field, inputCls, textareaCls, EmptyState } from './form'

/** Post / delete announcements. courseId null = shown to every LMS student. */
export function AnnouncementsPanel({ courseId, announcements, courseNames }: {
  courseId: string | null
  announcements: LmsAnnouncement[]
  courseNames?: Record<string, string>
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<LmsAnnouncement | null>(null)

  async function post() {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await lmsDb(supabase).from('lms_announcements')
      .insert({ course_id: courseId, title: title.trim(), body: body.trim(), created_by: user?.id ?? null })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setTitle(''); setBody('')
    toast.success('Announcement posted')
    router.refresh()
  }

  async function remove() {
    if (!toDelete) return
    const { error } = await lmsDb(createClient()).from('lms_announcements').delete().eq('id', toDelete.id)
    setToDelete(null)
    if (error) { toast.error(error.message); return }
    toast.success('Announcement deleted')
    router.refresh()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 h-fit">
        <p className="text-sm font-semibold text-gray-800">
          {courseId ? 'Post to this course' : 'Post to all LMS students'}
        </p>
        <Field label="Title">
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Exam form deadline extended" />
        </Field>
        <Field label="Message">
          <textarea className={textareaCls} rows={4} value={body} onChange={e => setBody(e.target.value)} />
        </Field>
        <Button onClick={post} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          <Megaphone className="h-4 w-4 mr-1.5" />{saving ? 'Posting…' : 'Post announcement'}
        </Button>
      </div>

      <div className="space-y-2">
        {announcements.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements yet" />
        ) : announcements.map(a => (
          <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-gray-900">{a.title}</p>
                {!courseId && (
                  <span className="text-[11px] rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">
                    {a.course_id ? (courseNames?.[a.course_id] ?? 'Course') : 'All students'}
                  </span>
                )}
              </div>
              {a.body && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{a.body}</p>}
              <p className="text-[11px] text-gray-400 mt-2">{fmtDateTime(a.created_at)}</p>
            </div>
            <button onClick={() => setToDelete(a)} className="h-8 w-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center" aria-label="Delete announcement">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        title="Delete announcement?"
        description={toDelete ? `"${toDelete.title}" will be removed for students.` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
    </div>
  )
}

'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, ClipboardCheck, ChevronRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { lmsDb, type LmsTest } from '@/lib/lms/shared'
import { Field, inputCls, textareaCls, EmptyState } from '../form'
import { cn } from '@/lib/utils'

export type TestRow = LmsTest & { questions: number; attempts: number }

export function TestsTab({ courseId, tests }: { courseId: string; tests: TestRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('30')
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!title.trim()) { toast.error('Test title is required'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await lmsDb(supabase).from('lms_tests').insert({
      course_id: courseId, title: title.trim(), description: description.trim(),
      duration_min: Math.max(1, parseInt(duration, 10) || 30), created_by: user?.id ?? null,
    }).select('id').single()
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Test created — add questions')
    router.push(`/lms/tests/${data.id}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <p className="text-sm text-gray-500">MCQ tests are auto-graded. Attach a test to a lesson from the Curriculum tab.</p>
        <Button onClick={() => { setTitle(''); setDescription(''); setDuration('30'); setOpen(true) }} className="bg-blue-600 hover:bg-blue-700 gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> New test
        </Button>
      </div>

      {tests.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No tests yet" hint="Create a test, add MCQs and publish it." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {tests.map(t => (
            <Link key={t.id} href={`/lms/tests/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
              <span className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <ClipboardCheck className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                <p className="text-[11px] text-gray-500 flex items-center gap-2">
                  <span>{t.questions} questions</span>
                  <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{t.duration_min} min</span>
                  <span>{t.attempts} attempts</span>
                </p>
              </div>
              <span className={cn('text-[11px] font-semibold rounded-full px-2 py-0.5 capitalize',
                t.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}>{t.status}</span>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New test</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Title"><input className={inputCls} autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Unit 1 practice test" /></Field>
            <Field label="Instructions (optional)"><textarea className={textareaCls} rows={2} value={description} onChange={e => setDescription(e.target.value)} /></Field>
            <Field label="Time limit (minutes)"><input className={inputCls} type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={create} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Creating…' : 'Create & add questions'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

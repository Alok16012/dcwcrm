'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Pencil, Trash2, Globe, EyeOff, ClipboardPaste, CheckCircle2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Field, inputCls, textareaCls, EmptyState } from '@/components/lms/form'
import { createClient } from '@/lib/supabase/client'
import { lmsDb, fmtDateTime, pct, type LmsAttempt, type LmsQuestion, type LmsTest } from '@/lib/lms/shared'
import { cn } from '@/lib/utils'

export interface AttemptRow { student: { full_name: string; enrollment_number: string } | null }

type Opt = 'a' | 'b' | 'c' | 'd'
const OPTS: Opt[] = ['a', 'b', 'c', 'd']

export function TestEditorClient({ test, course, questions, attempts }: {
  test: LmsTest
  course: { id: string; title: string }
  questions: LmsQuestion[]
  attempts: (LmsAttempt & AttemptRow)[]
}) {
  const router = useRouter()
  const [qDialog, setQDialog] = useState<{ open: boolean; q?: LmsQuestion }>({ open: false })
  const [bulkOpen, setBulkOpen] = useState(false)
  const [toDelete, setToDelete] = useState<LmsQuestion | null>(null)
  const [confirmDeleteTest, setConfirmDeleteTest] = useState(false)
  const [settings, setSettings] = useState({
    title: test.title, description: test.description, duration_min: String(test.duration_min),
    pass_percent: String(test.pass_percent), negative_marks: String(test.negative_marks), max_attempts: String(test.max_attempts),
  })
  const [saving, setSaving] = useState(false)

  const totalMarks = questions.reduce((n, q) => n + Number(q.marks), 0)
  const passed = attempts.filter(a => a.passed).length
  const avg = attempts.length ? Math.round(attempts.reduce((n, a) => n + pct(Number(a.score), Number(a.total)), 0) / attempts.length) : 0

  async function saveSettings() {
    if (!settings.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    const { error } = await lmsDb(createClient()).from('lms_tests').update({
      title: settings.title.trim(),
      description: settings.description.trim(),
      duration_min: Math.max(1, parseInt(settings.duration_min, 10) || 30),
      pass_percent: Math.min(100, Math.max(0, parseInt(settings.pass_percent, 10) || 0)),
      negative_marks: Math.max(0, parseFloat(settings.negative_marks) || 0),
      max_attempts: Math.max(0, parseInt(settings.max_attempts, 10) || 0),
    }).eq('id', test.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Test settings saved')
    router.refresh()
  }

  async function setStatus(status: 'draft' | 'published') {
    if (status === 'published' && questions.length === 0) { toast.error('Add at least one question first'); return }
    const { error } = await lmsDb(createClient()).from('lms_tests').update({ status }).eq('id', test.id)
    if (error) { toast.error(error.message); return }
    toast.success(status === 'published' ? 'Test published' : 'Test moved to draft')
    router.refresh()
  }

  async function removeQuestion() {
    if (!toDelete) return
    const { error } = await lmsDb(createClient()).from('lms_questions').delete().eq('id', toDelete.id)
    setToDelete(null)
    if (error) { toast.error(error.message); return }
    toast.success('Question deleted')
    router.refresh()
  }

  async function removeTest() {
    const { error } = await lmsDb(createClient()).from('lms_tests').delete().eq('id', test.id)
    setConfirmDeleteTest(false)
    if (error) { toast.error(error.message); return }
    toast.success('Test deleted')
    router.push(`/lms/courses/${course.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/lms/courses/${course.id}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> {course.title}
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{test.title}</h1>
              <span className={cn('text-[11px] font-semibold rounded-full px-2 py-0.5 capitalize',
                test.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}>{test.status}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{questions.length} questions · {totalMarks} marks · {test.duration_min} min · pass at {test.pass_percent}%</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {test.status === 'published'
              ? <Button variant="outline" onClick={() => setStatus('draft')} className="gap-1.5"><EyeOff className="h-4 w-4" />Unpublish</Button>
              : <Button onClick={() => setStatus('published')} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Globe className="h-4 w-4" />Publish</Button>}
            <Button variant="outline" onClick={() => setConfirmDeleteTest(true)} className="gap-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" />Delete</Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="questions">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="questions" className="text-xs px-3 py-1.5 rounded-lg">Questions ({questions.length})</TabsTrigger>
          <TabsTrigger value="results" className="text-xs px-3 py-1.5 rounded-lg">Results ({attempts.length})</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs px-3 py-1.5 rounded-lg">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4 space-y-3">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-1.5"><ClipboardPaste className="h-4 w-4" />Bulk paste</Button>
            <Button onClick={() => setQDialog({ open: true })} className="bg-blue-600 hover:bg-blue-700 gap-1.5"><Plus className="h-4 w-4" />Add question</Button>
          </div>
          {questions.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No questions yet" hint="Add questions one by one, or paste many at once." />
          ) : questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex gap-3">
                <span className="text-xs font-bold text-gray-400 pt-0.5">Q{i + 1}</span>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm text-gray-900 whitespace-pre-line">{q.question}</p>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {OPTS.filter(o => q[`opt_${o}`]).map(o => (
                      <div key={o} className={cn('text-xs rounded-lg px-2.5 py-1.5 border',
                        q.correct === o ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-medium' : 'border-gray-100 text-gray-600')}>
                        <span className="uppercase font-semibold mr-1">{o}.</span>{q[`opt_${o}`]}
                      </div>
                    ))}
                  </div>
                  {q.explanation && <p className="text-xs text-gray-500"><b>Explanation:</b> {q.explanation}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] text-gray-400">{Number(q.marks)} mark{Number(q.marks) !== 1 ? 's' : ''}</span>
                  <div className="flex">
                    <button onClick={() => setQDialog({ open: true, q })} className="h-7 w-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Edit question"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setToDelete(q)} className="h-7 w-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete question"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="results" className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-3 max-w-lg">
            {[['Attempts', attempts.length], ['Passed', passed], ['Avg score', `${avg}%`]].map(([k, v]) => (
              <div key={k} className="bg-white rounded-xl border border-gray-100 p-3">
                <p className="text-lg font-bold text-gray-900">{v}</p><p className="text-xs text-gray-500">{k}</p>
              </div>
            ))}
          </div>
          {attempts.length === 0 ? <EmptyState icon={CheckCircle2} title="No attempts yet" /> : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2.5">Student</th>
                    <th className="text-left font-semibold px-3 py-2.5">Score</th>
                    <th className="text-left font-semibold px-3 py-2.5">Correct / Wrong / Skipped</th>
                    <th className="text-left font-semibold px-3 py-2.5">Result</th>
                    <th className="text-left font-semibold px-3 py-2.5">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {attempts.map(a => (
                    <tr key={a.id}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{a.student?.full_name ?? '—'}</td>
                      <td className="px-3 py-2.5">{Number(a.score)} / {Number(a.total)} <span className="text-gray-400">({pct(Number(a.score), Number(a.total))}%)</span></td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{a.correct_cnt} / {a.wrong_cnt} / {a.unattempted}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn('text-[11px] font-semibold rounded-full px-2 py-0.5', a.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{a.passed ? 'Pass' : 'Fail'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(a.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 max-w-2xl">
            <Field label="Title"><input className={inputCls} value={settings.title} onChange={e => setSettings(s => ({ ...s, title: e.target.value }))} /></Field>
            <Field label="Instructions"><textarea className={textareaCls} rows={3} value={settings.description} onChange={e => setSettings(s => ({ ...s, description: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Time limit (min)"><input className={inputCls} type="number" min={1} value={settings.duration_min} onChange={e => setSettings(s => ({ ...s, duration_min: e.target.value }))} /></Field>
              <Field label="Pass mark (%)"><input className={inputCls} type="number" min={0} max={100} value={settings.pass_percent} onChange={e => setSettings(s => ({ ...s, pass_percent: e.target.value }))} /></Field>
              <Field label="Negative per wrong"><input className={inputCls} type="number" min={0} step={0.25} value={settings.negative_marks} onChange={e => setSettings(s => ({ ...s, negative_marks: e.target.value }))} /></Field>
              <Field label="Max attempts" hint="0 = unlimited"><input className={inputCls} type="number" min={0} value={settings.max_attempts} onChange={e => setSettings(s => ({ ...s, max_attempts: e.target.value }))} /></Field>
            </div>
            <Button onClick={saveSettings} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-1.5"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save settings'}</Button>
          </div>
        </TabsContent>
      </Tabs>

      <QuestionDialog key={qDialog.open ? (qDialog.q?.id ?? "new") : "closed"} testId={test.id} nextOrder={questions.length} state={qDialog} onClose={() => setQDialog({ open: false })} />
      <BulkDialog key={bulkOpen ? "open" : "closed"} testId={test.id} nextOrder={questions.length} open={bulkOpen} onClose={() => setBulkOpen(false)} />
      <ConfirmDialog open={!!toDelete} onCancel={() => setToDelete(null)} onConfirm={removeQuestion} destructive confirmLabel="Delete"
        title="Delete question?" description="Past attempts keep their score; the question is removed from future attempts." />
      <ConfirmDialog open={confirmDeleteTest} onCancel={() => setConfirmDeleteTest(false)} onConfirm={removeTest} destructive confirmLabel="Delete test"
        title="Delete this test?" description="All questions and student attempts for this test will be permanently deleted." />
    </div>
  )
}

const EMPTY_Q = { question: '', opt_a: '', opt_b: '', opt_c: '', opt_d: '', correct: 'a' as Opt, marks: '1', explanation: '' }

function QuestionDialog({ testId, nextOrder, state, onClose }: {
  testId: string; nextOrder: number; state: { open: boolean; q?: LmsQuestion }; onClose: () => void
}) {
  const router = useRouter()
  const [f, setF] = useState(() => {
    const q = state.q
    return q ? { question: q.question, opt_a: q.opt_a, opt_b: q.opt_b, opt_c: q.opt_c, opt_d: q.opt_d, correct: q.correct, marks: String(q.marks), explanation: q.explanation } : EMPTY_Q
  })
  const [saving, setSaving] = useState(false)

  async function save(addAnother: boolean) {
    if (!f.question.trim() || !f.opt_a.trim() || !f.opt_b.trim()) { toast.error('Question and options A and B are required'); return }
    if (!f[`opt_${f.correct}`].trim()) { toast.error('The correct option is empty'); return }
    setSaving(true)
    const payload = {
      question: f.question.trim(), opt_a: f.opt_a.trim(), opt_b: f.opt_b.trim(), opt_c: f.opt_c.trim(), opt_d: f.opt_d.trim(),
      correct: f.correct, marks: Math.max(0.25, parseFloat(f.marks) || 1), explanation: f.explanation.trim(),
    }
    const db = lmsDb(createClient())
    const { error } = state.q
      ? await db.from('lms_questions').update(payload).eq('id', state.q.id)
      : await db.from('lms_questions').insert({ ...payload, test_id: testId, sort_order: nextOrder })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(state.q ? 'Question updated' : 'Question added')
    router.refresh()
    if (addAnother && !state.q) setF({ ...EMPTY_Q, marks: f.marks })
    else onClose()
  }

  return (
    <Dialog open={state.open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{state.q ? 'Edit question' : 'Add question'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Question"><textarea className={textareaCls} rows={3} autoFocus value={f.question} onChange={e => setF(p => ({ ...p, question: e.target.value }))} /></Field>
          <p className="text-xs text-gray-500 -mb-1">Options — tick the correct one (C and D are optional)</p>
          {OPTS.map(o => (
            <div key={o} className="flex items-center gap-2">
              <input type="radio" name="correct" className="h-4 w-4 accent-emerald-600" checked={f.correct === o} onChange={() => setF(p => ({ ...p, correct: o }))} aria-label={`Option ${o.toUpperCase()} is correct`} />
              <span className="text-xs font-bold uppercase text-gray-500 w-4">{o}</span>
              <input className={cn(inputCls, f.correct === o && 'border-emerald-400')} value={f[`opt_${o}`]} onChange={e => setF(p => ({ ...p, [`opt_${o}`]: e.target.value }))} />
            </div>
          ))}
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <Field label="Marks"><input className={inputCls} type="number" min={0.25} step={0.25} value={f.marks} onChange={e => setF(p => ({ ...p, marks: e.target.value }))} /></Field>
            <Field label="Explanation (shown after submit)"><input className={inputCls} value={f.explanation} onChange={e => setF(p => ({ ...p, explanation: e.target.value }))} /></Field>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          {!state.q && <Button variant="outline" onClick={() => save(true)} disabled={saving}>Save & add another</Button>}
          <Button onClick={() => save(false)} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type Parsed = { question: string; opt_a: string; opt_b: string; opt_c: string; opt_d: string; correct: Opt; explanation: string }

/** Blocks separated by a blank line: question lines, then "A) …" to "D) …", then "Answer: B", optional "Explanation: …". */
function parseBulk(text: string): { items: Parsed[]; errors: string[] } {
  const items: Parsed[] = []
  const errors: string[] = []
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  blocks.forEach((block, i) => {
    const q: Parsed = { question: '', opt_a: '', opt_b: '', opt_c: '', opt_d: '', correct: 'a', explanation: '' }
    const qLines: string[] = []
    let answer = ''
    for (const raw of block.split('\n')) {
      const line = raw.trim()
      const opt = line.match(/^\(?([a-dA-D])[).:\]]\s*(.+)$/)
      const ans = line.match(/^(?:ans(?:wer)?|correct)\s*[:\-]\s*\(?([a-dA-D])\)?/i)
      const exp = line.match(/^(?:explanation|exp|solution)\s*[:\-]\s*(.+)$/i)
      if (ans) answer = ans[1]!.toLowerCase()
      else if (exp) q.explanation = exp[1]!
      else if (opt) q[`opt_${opt[1]!.toLowerCase() as Opt}`] = opt[2]!
      else qLines.push(line.replace(/^(?:q(?:uestion)?\s*\d*[).:]|\d+[).:])\s*/i, ''))
    }
    q.question = qLines.join('\n').trim()
    if (!q.question || !q.opt_a || !q.opt_b) { errors.push(`Block ${i + 1}: needs a question and at least options A and B`); return }
    if (!answer || !q[`opt_${answer as Opt}`]) { errors.push(`Block ${i + 1}: missing or invalid "Answer:" line`); return }
    q.correct = answer as Opt
    items.push(q)
  })
  return { items, errors }
}

const SAMPLE = `1. Who wrote "Godan"?
A) Premchand
B) Tagore
C) Nirala
D) Dinkar
Answer: A
Explanation: Godan (1936) is Munshi Premchand's last complete novel.

2. 15 × 4 = ?
A) 45
B) 60
C) 65
D) 75
Answer: B`

function BulkDialog({ testId, nextOrder, open, onClose }: { testId: string; nextOrder: number; open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const { items, errors } = parseBulk(text)

  async function save() {
    if (items.length === 0) return
    setSaving(true)
    const rows = items.map((q, i) => ({ ...q, test_id: testId, marks: 1, sort_order: nextOrder + i }))
    const { error } = await lmsDb(createClient()).from('lms_questions').insert(rows)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(`${rows.length} questions added`)
    onClose()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Bulk paste questions</DialogTitle></DialogHeader>
        <p className="text-xs text-gray-500">
          One question per block, blocks separated by a blank line. Options as <code>A)</code> … <code>D)</code>, then <code>Answer: B</code>. Each question is worth 1 mark (edit afterwards to change).
          <button type="button" className="ml-1 text-blue-600 hover:underline" onClick={() => setText(SAMPLE)}>Insert example</button>
        </p>
        <textarea className={cn(textareaCls, 'font-mono text-xs')} rows={14} value={text} onChange={e => setText(e.target.value)} placeholder={SAMPLE} />
        {text.trim() && (
          <div className="text-xs space-y-1">
            <p className="text-emerald-700 font-medium">{items.length} question{items.length !== 1 ? 's' : ''} ready</p>
            {errors.map(e => <p key={e} className="text-red-600">{e}</p>)}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || items.length === 0} className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Adding…' : `Add ${items.length} question${items.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

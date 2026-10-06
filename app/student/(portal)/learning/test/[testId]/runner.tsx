'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Clock, Send, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { lmsDb, type LmsTest } from '@/lib/lms/shared'
import { cn } from '@/lib/utils'

export interface RunnerQuestion { id: string; question: string; opt_a: string; opt_b: string; opt_c: string; opt_d: string; marks: number }

type Opt = 'a' | 'b' | 'c' | 'd'
const OPTS: Opt[] = ['a', 'b', 'c', 'd']

function fmtClock(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function TestRunner({ test, questions, attemptsLeft, backHref }: {
  test: LmsTest
  questions: RunnerQuestion[]
  attemptsLeft: number | null
  backHref: string
}) {
  const router = useRouter()
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<string, Opt>>({})
  const [current, setCurrent] = useState(0)
  const [remaining, setRemaining] = useState(test.duration_min * 60)
  const [submitting, setSubmitting] = useState(false)
  const submitted = useRef(false)
  const answersRef = useRef(answers)
  useEffect(() => { answersRef.current = answers }, [answers])

  const submit = useCallback(async (auto = false) => {
    if (submitted.current || startedAt === null) return
    submitted.current = true
    setSubmitting(true)
    const { data, error } = await lmsDb(createClient()).rpc('lms_submit_test', {
      p_test: test.id, p_answers: answersRef.current, p_started_at: new Date(startedAt).toISOString(),
    })
    if (error) {
      submitted.current = false
      setSubmitting(false)
      toast.error(error.message)
      return
    }
    if (auto) toast.info('Time is up — your test was submitted')
    router.replace(`/student/learning/result/${data as string}`)
  }, [router, startedAt, test.id])

  useEffect(() => {
    if (startedAt === null) return
    const tick = () => {
      const left = Math.max(0, test.duration_min * 60 - Math.floor((Date.now() - startedAt) / 1000))
      setRemaining(left)
      if (left === 0) submit(true)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt, test.duration_min, submit])

  // Warn before leaving mid-test.
  useEffect(() => {
    if (startedAt === null) return
    const onLeave = (e: BeforeUnloadEvent) => { if (!submitted.current) e.preventDefault() }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [startedAt])

  if (questions.length === 0) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-gray-100 p-10 text-center">
        <p className="text-gray-600">This test has no questions yet.</p>
        <Link href={backHref} className="text-sm text-blue-600 mt-3 inline-block">Back to course</Link>
      </div>
    )
  }

  if (startedAt === null) {
    const totalMarks = questions.reduce((n, q) => n + Number(q.marks), 0)
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Link href={backHref} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ArrowLeft className="h-3.5 w-3.5" />Back to course</Link>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><Trophy className="h-6 w-6" /></span>
            <h1 className="text-lg font-bold text-gray-900">{test.title}</h1>
          </div>
          {test.description && <p className="text-sm text-gray-600 whitespace-pre-line">{test.description}</p>}
          <ul className="text-sm text-gray-700 space-y-1.5 list-disc pl-5">
            <li>{questions.length} questions, {totalMarks} marks</li>
            <li>Time limit: {test.duration_min} minutes — the test submits itself when time runs out</li>
            <li>Pass mark: {test.pass_percent}%</li>
            {Number(test.negative_marks) > 0 && <li>{Number(test.negative_marks)} mark deducted for each wrong answer; skipped questions lose nothing</li>}
            {attemptsLeft !== null && <li>Attempts left: {attemptsLeft}</li>}
          </ul>
          {attemptsLeft !== null && attemptsLeft <= 0 ? (
            <p className="text-sm font-medium text-red-600">You have used all attempts for this test.</p>
          ) : (
            <button onClick={() => setStartedAt(Date.now())} className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold h-11">
              Start test
            </button>
          )}
        </div>
      </div>
    )
  }

  const q = questions[current]!
  const answered = Object.keys(answers).length
  const lowTime = remaining <= 60

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
        <p className="text-sm font-semibold text-gray-900 truncate flex-1">{test.title}</p>
        <span className="text-xs text-gray-500">{answered}/{questions.length} answered</span>
        <span className={cn('inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-mono font-semibold', lowTime ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-800')}>
          <Clock className="h-3.5 w-3.5" />{fmtClock(remaining)}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6 space-y-4">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Question {current + 1} of {questions.length}</span>
          <span>{Number(q.marks)} mark{Number(q.marks) !== 1 ? 's' : ''}</span>
        </div>
        <p className="text-[15px] text-gray-900 whitespace-pre-line leading-relaxed">{q.question}</p>
        <div className="space-y-2">
          {OPTS.filter(o => q[`opt_${o}`]).map(o => {
            const picked = answers[q.id] === o
            return (
              <button key={o} type="button" onClick={() => setAnswers(a => ({ ...a, [q.id]: o }))}
                className={cn('w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors',
                  picked ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-gray-200 hover:bg-gray-50 text-gray-800')}>
                <span className={cn('h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold uppercase',
                  picked ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600')}>{o}</span>
                <span className="pt-0.5">{q[`opt_${o}`]}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between pt-2">
          <button disabled={current === 0} onClick={() => setCurrent(c => c - 1)} className="text-sm text-gray-600 disabled:opacity-30">‹ Previous</button>
          {answers[q.id] && (
            <button onClick={() => setAnswers(a => { const n = { ...a }; delete n[q.id]; return n })} className="text-xs text-gray-400 hover:text-gray-700">Clear answer</button>
          )}
          {current < questions.length - 1
            ? <button onClick={() => setCurrent(c => c + 1)} className="text-sm font-medium text-blue-600">Next ›</button>
            : <span />}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {questions.map((qq, i) => (
            <button key={qq.id} onClick={() => setCurrent(i)} aria-label={`Go to question ${i + 1}`}
              className={cn('h-8 w-8 rounded-lg text-xs font-semibold border',
                i === current ? 'border-blue-600 ring-2 ring-blue-200' : 'border-transparent',
                answers[qq.id] ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600')}>
              {i + 1}
            </button>
          ))}
        </div>
        <button disabled={submitting} onClick={() => {
          const skipped = questions.length - answered
          if (skipped > 0 && !window.confirm(`${skipped} question${skipped > 1 ? 's are' : ' is'} unanswered. Submit anyway?`)) return
          submit()
        }} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold h-11">
          <Send className="h-4 w-4" />{submitting ? 'Submitting…' : 'Submit test'}
        </button>
      </div>
    </div>
  )
}

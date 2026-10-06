import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { requireStudent } from '@/lib/lms/server'
import { fmtDateTime, pct, type LmsAttempt } from '@/lib/lms/shared'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Review = { id: string; question: string; opt_a: string; opt_b: string; opt_c: string; opt_d: string; correct: string; chosen: string | null; marks: number; explanation: string }
const OPTS = ['a', 'b', 'c', 'd'] as const

export default async function AttemptResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  const { db } = await requireStudent()

  const { data: attempt } = await db.from('lms_test_attempts')
    .select('*, test:lms_tests(id, title, course_id, pass_percent, max_attempts)').eq('id', attemptId).maybeSingle()
  if (!attempt) notFound()
  const a = attempt as LmsAttempt & { test: { id: string; title: string; course_id: string; pass_percent: number; max_attempts: number } | null }

  const [{ data: review }, { data: lesson }] = await Promise.all([
    db.rpc('lms_attempt_review', { p_attempt: attemptId }),
    db.from('lms_lessons').select('id').eq('test_id', a.test_id).limit(1).maybeSingle(),
  ])
  const items = (review ?? []) as Review[]
  const p = pct(Number(a.score), Number(a.total))
  const backHref = a.test ? `/student/learning/${a.test.course_id}${lesson ? `?lesson=${(lesson as { id: string }).id}` : ''}` : '/student/learning'

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href={backHref} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ArrowLeft className="h-3.5 w-3.5" />Back to course</Link>

      <div className={cn('rounded-2xl p-6 text-white', a.passed ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' : 'bg-gradient-to-br from-rose-500 to-rose-700')}>
        <p className="text-xs uppercase tracking-widest text-white/80 font-semibold">{a.test?.title ?? 'Test'} · result</p>
        <p className="text-4xl font-extrabold mt-2">{Number(a.score)} <span className="text-xl font-semibold text-white/80">/ {Number(a.total)}</span></p>
        <p className="text-sm mt-1">{p}% · {a.passed ? 'Passed 🎉' : `Not passed — pass mark is ${a.test?.pass_percent ?? 0}%`}</p>
        <div className="flex gap-4 mt-4 text-sm">
          <span>✔ {a.correct_cnt} correct</span><span>✘ {a.wrong_cnt} wrong</span><span>– {a.unattempted} skipped</span>
        </div>
        <p className="text-[11px] text-white/70 mt-3">Submitted {fmtDateTime(a.submitted_at)}</p>
      </div>

      {a.test && (
        <Link href={`/student/learning/test/${a.test.id}`} className="inline-flex text-sm font-semibold text-blue-600 hover:underline">Retake test →</Link>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Answer review</h2>
        {items.map((q, i) => {
          const status = !q.chosen ? 'skipped' : q.chosen === q.correct ? 'correct' : 'wrong'
          const Icon = status === 'correct' ? CheckCircle2 : status === 'wrong' ? XCircle : MinusCircle
          return (
            <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
              <div className="flex gap-2">
                <Icon className={cn('h-5 w-5 shrink-0', status === 'correct' ? 'text-emerald-500' : status === 'wrong' ? 'text-red-500' : 'text-gray-300')} />
                <p className="text-sm text-gray-900 whitespace-pre-line"><span className="font-semibold text-gray-400 mr-1">Q{i + 1}.</span>{q.question}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-1.5 pl-7">
                {OPTS.filter(o => q[`opt_${o}`]).map(o => (
                  <div key={o} className={cn('text-xs rounded-lg px-2.5 py-1.5 border',
                    o === q.correct ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-medium'
                      : o === q.chosen ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-100 text-gray-600')}>
                    <span className="uppercase font-semibold mr-1">{o}.</span>{q[`opt_${o}`]}
                    {o === q.chosen && <span className="ml-1 text-[10px]">(your answer)</span>}
                  </div>
                ))}
              </div>
              {q.explanation && <p className="text-xs text-gray-600 pl-7"><b>Explanation:</b> {q.explanation}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

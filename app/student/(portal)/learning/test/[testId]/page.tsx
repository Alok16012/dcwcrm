import { notFound } from 'next/navigation'
import { requireStudent } from '@/lib/lms/server'
import type { LmsTest } from '@/lib/lms/shared'
import { TestRunner, type RunnerQuestion } from './runner'

export const dynamic = 'force-dynamic'

export default async function TakeTestPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params
  const { student, db } = await requireStudent()

  const { data: test } = await db.from('lms_tests').select('*').eq('id', testId).maybeSingle()
  if (!test) notFound()
  const t = test as LmsTest

  const [{ data: questions }, { count: used }] = await Promise.all([
    db.rpc('lms_test_questions', { p_test: testId }),
    db.from('lms_test_attempts').select('id', { count: 'exact', head: true }).eq('test_id', testId).eq('student_id', student.id),
  ])

  const attemptsLeft = t.max_attempts > 0 ? t.max_attempts - (used ?? 0) : null
  // Which lesson this test belongs to, for the "back to course" link.
  const { data: lesson } = await db.from('lms_lessons').select('id').eq('test_id', testId).limit(1).maybeSingle()

  return (
    <TestRunner
      test={t}
      questions={(questions ?? []) as RunnerQuestion[]}
      attemptsLeft={attemptsLeft}
      backHref={`/student/learning/${t.course_id}${lesson ? `?lesson=${(lesson as { id: string }).id}` : ''}`}
    />
  )
}

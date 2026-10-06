import { notFound } from 'next/navigation'
import { requireLmsManager } from '@/lib/lms/server'
import type { LmsAttempt, LmsQuestion, LmsTest } from '@/lib/lms/shared'
import { TestEditorClient, type AttemptRow } from './client'

export const dynamic = 'force-dynamic'

export default async function LmsTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await requireLmsManager()

  const { data: test } = await db.from('lms_tests').select('*, course:lms_courses(id, title)').eq('id', id).maybeSingle()
  if (!test) notFound()

  const [questionsRes, attemptsRes] = await Promise.all([
    db.from('lms_questions').select('*').eq('test_id', id).order('sort_order'),
    db.from('lms_test_attempts')
      .select('id, student_id, score, total, correct_cnt, wrong_cnt, unattempted, passed, started_at, submitted_at, student:students(full_name, enrollment_number)')
      .eq('test_id', id).order('submitted_at', { ascending: false }),
  ])

  const { course, ...t } = test as LmsTest & { course: { id: string; title: string } }
  return (
    <TestEditorClient
      test={t}
      course={course}
      questions={(questionsRes.data ?? []) as LmsQuestion[]}
      attempts={(attemptsRes.data ?? []) as unknown as (LmsAttempt & AttemptRow)[]}
    />
  )
}

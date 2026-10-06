import { notFound } from 'next/navigation'
import { requireStudent } from '@/lib/lms/server'
import type { LmsCourse, LmsLesson, LmsLiveClass, LmsModule, LmsTest } from '@/lib/lms/shared'
import { CoursePlayer, type AttemptSummary } from './player'

export const dynamic = 'force-dynamic'

export default async function StudentCoursePage({ params, searchParams }: {
  params: Promise<{ courseId: string }>
  searchParams: Promise<{ lesson?: string }>
}) {
  const [{ courseId }, { lesson: lessonParam }] = await Promise.all([params, searchParams])
  const { student, db } = await requireStudent()

  const { data: course } = await db.from('lms_courses').select('*').eq('id', courseId).maybeSingle()
  if (!course) notFound() // also covers "not enrolled" — RLS hides the row

  const [modulesRes, lessonsRes, progressRes, testsRes, attemptsRes, classesRes] = await Promise.all([
    db.from('lms_modules').select('*').eq('course_id', courseId).order('sort_order'),
    db.from('lms_lessons').select('*').eq('course_id', courseId).order('sort_order'),
    db.from('lms_lesson_progress').select('lesson_id').eq('course_id', courseId).eq('student_id', student.id),
    db.from('lms_tests').select('id, title, description, duration_min, pass_percent, max_attempts, negative_marks, status').eq('course_id', courseId),
    db.from('lms_test_attempts').select('id, test_id, score, total, passed, submitted_at').eq('student_id', student.id).order('submitted_at', { ascending: false }),
    db.from('lms_live_classes').select('*').eq('course_id', courseId).neq('status', 'cancelled').order('start_at', { ascending: false }),
  ])

  const modules = (modulesRes.data ?? []) as LmsModule[]
  const order = new Map(modules.map((m, i) => [m.id, i]))
  // Flatten into the order students walk through: module order, then lesson order.
  const lessons = ((lessonsRes.data ?? []) as LmsLesson[])
    .filter(l => order.has(l.module_id))
    .sort((a, b) => (order.get(a.module_id)! - order.get(b.module_id)!) || a.sort_order - b.sort_order)
  const done = ((progressRes.data ?? []) as { lesson_id: string }[]).map(p => p.lesson_id)
  const doneSet = new Set(done)
  const current = lessons.find(l => l.id === lessonParam) ?? lessons.find(l => !doneSet.has(l.id)) ?? lessons[0] ?? null

  return (
    <CoursePlayer
      studentId={student.id}
      course={course as LmsCourse}
      modules={modules}
      lessons={lessons}
      completed={done}
      currentId={current?.id ?? null}
      tests={(testsRes.data ?? []) as LmsTest[]}
      attempts={(attemptsRes.data ?? []) as AttemptSummary[]}
      classes={(classesRes.data ?? []) as LmsLiveClass[]}
    />
  )
}

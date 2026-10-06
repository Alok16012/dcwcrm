import { notFound } from 'next/navigation'
import { requireLmsManager } from '@/lib/lms/server'
import type { LmsAnnouncement, LmsAttempt, LmsCourse, LmsLesson, LmsLiveClass, LmsModule, LmsTest } from '@/lib/lms/shared'
import type { CrmCourseOption } from '@/components/lms/CourseFormDialog'
import { CourseBuilderClient, type StudentRow, type Learner } from './client'

export const dynamic = 'force-dynamic'

export default async function LmsCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db } = await requireLmsManager()

  const { data: course } = await db.from('lms_courses').select('*').eq('id', id).maybeSingle()
  if (!course) notFound()
  const c = course as LmsCourse

  const [modulesRes, lessonsRes, testsRes, classesRes, annRes, enrollRes, progressRes, attemptsRes, crmRes, studentsRes] = await Promise.all([
    db.from('lms_modules').select('*').eq('course_id', id).order('sort_order'),
    db.from('lms_lessons').select('*').eq('course_id', id).order('sort_order'),
    db.from('lms_tests').select('*, lms_questions(count)').eq('course_id', id).order('created_at', { ascending: false }),
    db.from('lms_live_classes').select('*').eq('course_id', id).order('start_at', { ascending: false }),
    db.from('lms_announcements').select('*').eq('course_id', id).order('created_at', { ascending: false }),
    db.from('lms_enrollments').select('student_id, enrolled_at').eq('course_id', id),
    db.from('lms_lesson_progress').select('student_id, lesson_id, completed_at').eq('course_id', id),
    db.from('lms_test_attempts').select('id, test_id, student_id, score, total, passed, submitted_at, lms_tests!inner(course_id)')
      .eq('lms_tests.course_id', id),
    db.from('courses').select('id, name, sub_courses(id, name)').eq('is_active', true).order('name'),
    db.from('students')
      .select('id, full_name, enrollment_number, phone, course_id, sub_course_id, portal_user_id, status, course:courses(name), sub_course:sub_courses(name)')
      .neq('status', 'dropped').order('full_name'),
  ])

  const students = (studentsRes.data ?? []) as unknown as StudentRow[]
  const enrollments = (enrollRes.data ?? []) as { student_id: string; enrolled_at: string }[]
  const progress = (progressRes.data ?? []) as { student_id: string; lesson_id: string; completed_at: string }[]
  const attempts = (attemptsRes.data ?? []) as Pick<LmsAttempt, 'id' | 'test_id' | 'student_id' | 'score' | 'total' | 'passed' | 'submitted_at'>[]
  const lessons = (lessonsRes.data ?? []) as LmsLesson[]
  const publishedLessonIds = new Set(lessons.filter(l => l.is_published).map(l => l.id))

  const enrolledAt = new Map(enrollments.map(e => [e.student_id, e.enrolled_at]))
  const learners: Learner[] = students
    .filter(s => enrolledAt.has(s.id) || (c.auto_enroll && c.crm_course_id && s.course_id === c.crm_course_id
      && (!c.crm_sub_course_id || s.sub_course_id === c.crm_sub_course_id)))
    .map(s => {
      const mine = progress.filter(p => p.student_id === s.id && publishedLessonIds.has(p.lesson_id))
      const myAttempts = attempts.filter(a => a.student_id === s.id)
      const times = [...mine.map(p => p.completed_at), ...myAttempts.map(a => a.submitted_at)].sort()
      return {
        ...s,
        source: enrolledAt.has(s.id) ? 'manual' as const : 'auto' as const,
        enrolled_at: enrolledAt.get(s.id) ?? null,
        completed: mine.length,
        attempts: myAttempts.length,
        best_pct: myAttempts.length ? Math.max(...myAttempts.map(a => (a.total > 0 ? Math.round((a.score / a.total) * 100) : 0))) : null,
        last_active: times.at(-1) ?? null,
      }
    })

  const attemptCount = new Map<string, number>()
  for (const a of attempts) attemptCount.set(a.test_id, (attemptCount.get(a.test_id) ?? 0) + 1)
  const tests = ((testsRes.data ?? []) as (LmsTest & { lms_questions: { count: number }[] })[]).map(({ lms_questions, ...t }) => ({
    ...t, questions: lms_questions[0]?.count ?? 0, attempts: attemptCount.get(t.id) ?? 0,
  }))

  return (
    <CourseBuilderClient
      course={c}
      modules={(modulesRes.data ?? []) as LmsModule[]}
      lessons={lessons}
      tests={tests}
      classes={(classesRes.data ?? []) as LmsLiveClass[]}
      announcements={(annRes.data ?? []) as LmsAnnouncement[]}
      learners={learners}
      students={students}
      crmCourses={(crmRes.data ?? []) as CrmCourseOption[]}
      publishedLessons={publishedLessonIds.size}
    />
  )
}

import { requireLmsManager } from '@/lib/lms/server'
import type { LmsAnnouncement, LmsCourse } from '@/lib/lms/shared'
import type { CrmCourseOption } from '@/components/lms/CourseFormDialog'
import { LmsHomeClient, type CourseCard } from './client'

export const dynamic = 'force-dynamic'

export default async function LmsPage() {
  const { db } = await requireLmsManager()

  const [coursesRes, crmRes, enrollRes, studentsRes, classesRes, attemptsRes, annRes] = await Promise.all([
    db.from('lms_courses').select('*, lms_lessons(count)').order('sort_order').order('created_at', { ascending: false }),
    db.from('courses').select('id, name, sub_courses(id, name)').eq('is_active', true).order('name'),
    db.from('lms_enrollments').select('course_id, student_id'),
    db.from('students').select('id, course_id, sub_course_id').neq('status', 'dropped'),
    db.from('lms_live_classes').select('id', { count: 'exact', head: true }).eq('status', 'scheduled').gte('start_at', new Date().toISOString()),
    db.from('lms_test_attempts').select('id', { count: 'exact', head: true }),
    db.from('lms_announcements').select('*').order('created_at', { ascending: false }).limit(50),
  ])

  const courses = (coursesRes.data ?? []) as (LmsCourse & { lms_lessons: { count: number }[] })[]
  const enrollments = (enrollRes.data ?? []) as { course_id: string; student_id: string }[]
  const students = (studentsRes.data ?? []) as { id: string; course_id: string | null; sub_course_id: string | null }[]

  // Learners = explicit enrollments ∪ students matched by auto-enroll.
  const allLearners = new Set<string>()
  const cards: CourseCard[] = courses.map(c => {
    const set = new Set(enrollments.filter(e => e.course_id === c.id).map(e => e.student_id))
    if (c.auto_enroll && c.crm_course_id) {
      for (const s of students) {
        if (s.course_id === c.crm_course_id && (!c.crm_sub_course_id || s.sub_course_id === c.crm_sub_course_id)) set.add(s.id)
      }
    }
    set.forEach(id => allLearners.add(id))
    const { lms_lessons, ...course } = c
    return { ...course, lessons: lms_lessons[0]?.count ?? 0, learners: set.size }
  })

  return (
    <LmsHomeClient
      courses={cards}
      crmCourses={(crmRes.data ?? []) as CrmCourseOption[]}
      announcements={(annRes.data ?? []) as LmsAnnouncement[]}
      stats={{
        courses: courses.length,
        published: courses.filter(c => c.status === 'published').length,
        lessons: cards.reduce((n, c) => n + c.lessons, 0),
        learners: allLearners.size,
        upcomingClasses: classesRes.count ?? 0,
        attempts: attemptsRes.count ?? 0,
      }}
    />
  )
}

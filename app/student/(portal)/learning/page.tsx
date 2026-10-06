import Link from 'next/link'
import { MonitorPlay, CalendarClock, Megaphone, ExternalLink, BookOpen, ChevronRight, PlayCircle } from 'lucide-react'
import { requireStudent } from '@/lib/lms/server'
import { fmtDateTime, pct, type LmsAnnouncement, type LmsCourse, type LmsLiveClass } from '@/lib/lms/shared'

export const dynamic = 'force-dynamic'

/** Request time — a dynamic page renders once per request, so this is stable for the render. */
function requestTime() {
  return Date.now()
}

export default async function StudentLearningPage() {
  const { student, db } = await requireStudent()

  // RLS returns only published courses this student can access.
  const { data: coursesData } = await db.from('lms_courses').select('*, lms_lessons(id, is_published)').order('sort_order').order('created_at')
  const courses = (coursesData ?? []) as (LmsCourse & { lms_lessons: { id: string }[] })[]
  const courseIds = courses.map(c => c.id)

  const now = requestTime()
  const since = new Date(now - 3 * 3600_000).toISOString()
  const [progressRes, classesRes, annRes] = await Promise.all([
    db.from('lms_lesson_progress').select('lesson_id, course_id').eq('student_id', student.id),
    courseIds.length
      ? db.from('lms_live_classes').select('*').in('course_id', courseIds).eq('status', 'scheduled').gte('start_at', since).order('start_at').limit(5)
      : Promise.resolve({ data: [] }),
    db.from('lms_announcements').select('*').order('created_at', { ascending: false }).limit(5),
  ])

  const done = new Set(((progressRes.data ?? []) as { lesson_id: string }[]).map(p => p.lesson_id))
  const classes = (classesRes.data ?? []) as LmsLiveClass[]
  const announcements = (annRes.data ?? []) as LmsAnnouncement[]
  const courseTitle = Object.fromEntries(courses.map(c => [c.id, c.title]))

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Learning</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your courses, live classes and tests</p>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <MonitorPlay className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No courses assigned yet</p>
          <p className="text-sm text-gray-400 mt-1">Your institution will enroll you in online courses. Check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map(c => {
            const lessonIds = c.lms_lessons.map(l => l.id)
            const completed = lessonIds.filter(id => done.has(id)).length
            const p = pct(completed, lessonIds.length)
            return (
              <Link key={c.id} href={`/student/learning/${c.id}`}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-blue-200 transition-all">
                <div className="h-28 bg-gradient-to-br from-blue-600 to-indigo-700 relative">
                  {c.thumbnail_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    : <BookOpen className="absolute right-4 bottom-4 h-10 w-10 text-white/25" />}
                </div>
                <div className="p-4 space-y-3">
                  <p className="font-semibold text-gray-900 group-hover:text-blue-700 line-clamp-2">{c.title}</p>
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                      <span>{completed} of {lessonIds.length} lessons</span><span className="font-semibold text-gray-700">{p}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full ${p === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${p}%` }} />
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                    <PlayCircle className="h-3.5 w-3.5" />{completed === 0 ? 'Start learning' : p === 100 ? 'Review course' : 'Continue'}
                    <ChevronRight className="h-3.5 w-3.5 ml-auto text-gray-300" />
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {classes.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 bg-orange-50 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-orange-600" />
            <h2 className="font-semibold text-sm text-orange-700">Upcoming live classes</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {classes.map(cl => {
              const start = new Date(cl.start_at).getTime()
              const live = now >= start - 15 * 60_000 && now <= start + cl.duration_min * 60_000
              return (
                <div key={cl.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{cl.title}</p>
                    <p className="text-xs text-gray-500">{courseTitle[cl.course_id]} · {fmtDateTime(cl.start_at)} · {cl.duration_min} min</p>
                  </div>
                  {cl.join_url && (
                    <a href={cl.join_url} target="_blank" rel="noopener noreferrer"
                      className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg ${live ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      {live ? 'Join now' : 'Join link'} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {announcements.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 bg-blue-50 flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-blue-600" />
            <h2 className="font-semibold text-sm text-blue-700">Announcements</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {announcements.map(a => (
              <div key={a.id} className="px-5 py-3">
                <p className="text-sm font-medium text-gray-800">{a.title}</p>
                {a.body && <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line">{a.body}</p>}
                <p className="text-[11px] text-gray-400 mt-1">
                  {a.course_id ? `${courseTitle[a.course_id] ?? 'Course'} · ` : ''}{fmtDateTime(a.created_at)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

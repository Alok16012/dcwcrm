'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, BookOpen, Layers, Users, CalendarClock, ClipboardCheck, MonitorPlay, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { CourseFormDialog, type CrmCourseOption } from '@/components/lms/CourseFormDialog'
import { AnnouncementsPanel } from '@/components/lms/AnnouncementsPanel'
import { EmptyState, inputCls } from '@/components/lms/form'
import { STATUS_BADGE, type LmsAnnouncement, type LmsCourse } from '@/lib/lms/shared'
import { cn } from '@/lib/utils'

export type CourseCard = LmsCourse & { lessons: number; learners: number }

interface Stats { courses: number; published: number; lessons: number; learners: number; upcomingClasses: number; attempts: number }

export function LmsHomeClient({ courses, crmCourses, announcements, stats }: {
  courses: CourseCard[]
  crmCourses: CrmCourseOption[]
  announcements: LmsAnnouncement[]
  stats: Stats
}) {
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | LmsCourse['status']>('all')

  const crmName = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of crmCourses) {
      m[c.id] = c.name
      for (const s of c.sub_courses) m[s.id] = `${c.name} · ${s.name}`
    }
    return m
  }, [crmCourses])

  const courseNames = useMemo(() => Object.fromEntries(courses.map(c => [c.id, c.title])), [courses])

  const visible = courses.filter(c =>
    (status === 'all' || c.status === status) &&
    (!query.trim() || c.title.toLowerCase().includes(query.trim().toLowerCase()))
  )

  const statCards = [
    { label: 'Courses', value: stats.courses, sub: `${stats.published} published`, icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
    { label: 'Lessons', value: stats.lessons, icon: Layers, color: 'text-violet-600 bg-violet-50' },
    { label: 'Learners', value: stats.learners, icon: Users, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Upcoming classes', value: stats.upcomingClasses, icon: CalendarClock, color: 'text-orange-600 bg-orange-50' },
    { label: 'Test attempts', value: stats.attempts, icon: ClipboardCheck, color: 'text-amber-600 bg-amber-50' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="LMS"
        description="Build courses, lessons and tests, schedule live classes, and track student learning"
        action={
          <Button onClick={() => setCreating(true)} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
            <Plus className="h-4 w-4" /> New course
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <span className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', s.color)}>
              <s.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900 leading-tight">{s.value}</p>
              <p className="text-xs text-gray-500 truncate">{s.label}{s.sub ? ` · ${s.sub}` : ''}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="courses">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="courses" className="text-xs px-3 py-1.5 rounded-lg">Courses</TabsTrigger>
          <TabsTrigger value="announcements" className="text-xs px-3 py-1.5 rounded-lg">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input className={cn(inputCls, 'pl-9')} placeholder="Search courses…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <select className={cn(inputCls, 'w-36')} value={status} onChange={e => setStatus(e.target.value as typeof status)}>
              <option value="all">All status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {courses.length === 0 ? (
            <EmptyState icon={MonitorPlay} title="No LMS courses yet"
              hint="Create a course, add modules and lessons, then publish it for students."
              action={<Button onClick={() => setCreating(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-1" />Create first course</Button>} />
          ) : visible.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No courses match your filters.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map(c => (
                <Link key={c.id} href={`/lms/courses/${c.id}`}
                  className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-blue-200 hover:shadow-md transition-all">
                  <div className="h-32 bg-gradient-to-br from-blue-600 to-indigo-700 relative">
                    {c.thumbnail_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      : <BookOpen className="absolute right-4 bottom-4 h-12 w-12 text-white/25" />}
                    <span className={cn('absolute top-3 left-3 text-[11px] font-semibold rounded-full px-2 py-0.5 capitalize', STATUS_BADGE[c.status])}>{c.status}</span>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="font-semibold text-gray-900 group-hover:text-blue-700 line-clamp-2">{c.title}</p>
                    {c.crm_course_id && (
                      <p className="text-[11px] text-gray-500 flex items-center gap-1">
                        {c.auto_enroll && <Zap className="h-3 w-3 text-amber-500" />}
                        {crmName[c.crm_sub_course_id ?? ''] ?? crmName[c.crm_course_id] ?? 'Linked course'}
                        {c.auto_enroll ? ' · auto-enroll' : ''}
                      </p>
                    )}
                    <div className="flex gap-4 text-xs text-gray-500 pt-1">
                      <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{c.lessons} lessons</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.learners} learners</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="announcements" className="mt-4">
          <AnnouncementsPanel courseId={null} announcements={announcements} courseNames={courseNames} />
        </TabsContent>
      </Tabs>

      <CourseFormDialog open={creating} onOpenChange={setCreating} crmCourses={crmCourses} />
    </div>
  )
}

'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Pencil, Trash2, Globe, EyeOff, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { CourseFormDialog, type CrmCourseOption } from '@/components/lms/CourseFormDialog'
import { AnnouncementsPanel } from '@/components/lms/AnnouncementsPanel'
import { CurriculumTab } from '@/components/lms/admin/CurriculumTab'
import { TestsTab, type TestRow } from '@/components/lms/admin/TestsTab'
import { ClassesTab } from '@/components/lms/admin/ClassesTab'
import { StudentsTab, type Learner, type StudentRow } from '@/components/lms/admin/StudentsTab'
import { createClient } from '@/lib/supabase/client'
import { lmsDb, STATUS_BADGE, type LmsAnnouncement, type LmsCourse, type LmsLesson, type LmsLiveClass, type LmsModule } from '@/lib/lms/shared'
import { cn } from '@/lib/utils'

export type { Learner, StudentRow }

const TAB_CLS = 'whitespace-nowrap text-xs px-3 py-1.5 rounded-lg'

export function CourseBuilderClient({ course, modules, lessons, tests, classes, announcements, learners, students, crmCourses, publishedLessons }: {
  course: LmsCourse
  modules: LmsModule[]
  lessons: LmsLesson[]
  tests: TestRow[]
  classes: LmsLiveClass[]
  announcements: LmsAnnouncement[]
  learners: Learner[]
  students: StudentRow[]
  crmCourses: CrmCourseOption[]
  publishedLessons: number
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const crm = crmCourses.find(c => c.id === course.crm_course_id)
  const crmLabel = crm ? [crm.name, crm.sub_courses.find(s => s.id === course.crm_sub_course_id)?.name].filter(Boolean).join(' · ') : null

  async function setStatus(status: LmsCourse['status']) {
    if (status === 'published' && publishedLessons === 0) {
      toast.error('Add at least one visible lesson before publishing')
      return
    }
    setBusy(true)
    const { error } = await lmsDb(createClient()).from('lms_courses').update({ status }).eq('id', course.id)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(status === 'published' ? 'Course published — enrolled students can see it now' : 'Course moved to draft')
    router.refresh()
  }

  async function remove() {
    setBusy(true)
    const { error } = await lmsDb(createClient()).from('lms_courses').delete().eq('id', course.id)
    setBusy(false)
    setConfirmDelete(false)
    if (error) { toast.error(error.message); return }
    toast.success('Course deleted')
    router.push('/lms')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/lms" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> All courses
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
              <span className={cn('text-[11px] font-semibold rounded-full px-2 py-0.5 capitalize', STATUS_BADGE[course.status])}>{course.status}</span>
            </div>
            {course.description && <p className="text-sm text-gray-500 mt-1 max-w-2xl">{course.description}</p>}
            {crmLabel && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                {course.auto_enroll && <Zap className="h-3 w-3 text-amber-500" />}
                Linked to {crmLabel}{course.auto_enroll ? ' — admitted students get access automatically' : ''}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {course.status === 'published' ? (
              <Button variant="outline" disabled={busy} onClick={() => setStatus('draft')} className="gap-1.5"><EyeOff className="h-4 w-4" />Unpublish</Button>
            ) : (
              <Button disabled={busy} onClick={() => setStatus('published')} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Globe className="h-4 w-4" />Publish</Button>
            )}
            <Button variant="outline" onClick={() => setEditing(true)} className="gap-1.5"><Pencil className="h-4 w-4" />Edit</Button>
            <Button variant="outline" onClick={() => setConfirmDelete(true)} className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" />Delete</Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="curriculum">
        <div className="overflow-x-auto pb-1">
          <TabsList className="bg-slate-100 p-1 rounded-xl min-w-max">
            <TabsTrigger value="curriculum" className={TAB_CLS}>Curriculum ({lessons.length})</TabsTrigger>
            <TabsTrigger value="tests" className={TAB_CLS}>Tests ({tests.length})</TabsTrigger>
            <TabsTrigger value="classes" className={TAB_CLS}>Live Classes ({classes.length})</TabsTrigger>
            <TabsTrigger value="students" className={TAB_CLS}>Students ({learners.length})</TabsTrigger>
            <TabsTrigger value="announcements" className={TAB_CLS}>Announcements</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="curriculum" className="mt-4">
          <CurriculumTab courseId={course.id} modules={modules} lessons={lessons} tests={tests} />
        </TabsContent>
        <TabsContent value="tests" className="mt-4">
          <TestsTab courseId={course.id} tests={tests} />
        </TabsContent>
        <TabsContent value="classes" className="mt-4">
          <ClassesTab courseId={course.id} classes={classes} />
        </TabsContent>
        <TabsContent value="students" className="mt-4">
          <StudentsTab courseId={course.id} learners={learners} students={students} publishedLessons={publishedLessons} crmCourses={crmCourses} />
        </TabsContent>
        <TabsContent value="announcements" className="mt-4">
          <AnnouncementsPanel courseId={course.id} announcements={announcements} />
        </TabsContent>
      </Tabs>

      <CourseFormDialog open={editing} onOpenChange={setEditing} course={course} crmCourses={crmCourses} />
      <ConfirmDialog open={confirmDelete} onCancel={() => setConfirmDelete(false)} onConfirm={remove} destructive confirmLabel="Delete course"
        title="Delete this course?"
        description="All modules, lessons, tests, attempts, live classes, enrollments and student progress for this course will be permanently deleted." />
    </div>
  )
}

import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StudentSidebar } from '@/components/student/StudentSidebar'
import { StudentBottomNav } from '@/components/student/StudentBottomNav'
import { StudentTopbar } from '@/components/student/StudentTopbar'

export default async function StudentPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/student/login')

  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, enrollment_number, profile_photo_url, course:courses(name), portal_active')
    .eq('portal_user_id', user.id)
    .single()

  if (!student) redirect('/student/login')

  const studentInfo = {
    id: (student as { id: string }).id,
    full_name: (student as { full_name: string }).full_name,
    enrollment_number: (student as { enrollment_number: string }).enrollment_number,
    profile_photo_url: (student as { profile_photo_url: string | null }).profile_photo_url ?? null,
    course_name: ((student as { course: { name: string } | null }).course)?.name ?? null,
  }

  return (
    <div className="flex h-screen overflow-hidden app-bg">
      <StudentSidebar student={studentInfo} />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <StudentTopbar student={studentInfo} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 pb-24 md:pb-6">
            {children}
          </div>
          <footer className="py-4 pb-24 md:pb-4 text-center text-xs text-gray-400 border-t border-gray-100/70">
            Distance Courses Wala Student Portal &mdash; Powered by{' '}
            <a href="https://blinks-ai.com" target="_blank" rel="noopener noreferrer" className="text-blue-500">Blinks AI</a>
          </footer>
        </main>
      </div>
      <StudentBottomNav />
    </div>
  )
}

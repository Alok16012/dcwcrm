'use client'
import { Bell, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'

interface StudentInfo {
  id: string
  full_name: string
  enrollment_number: string
  profile_photo_url: string | null
  course_name: string | null
}

export function StudentTopbar({ student }: { student: StudentInfo }) {
  const supabase = createClient()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    async function fetchUnread() {
      const { count } = await (supabase as any)
        .from('student_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', student.id)
        .eq('is_read', false)
      setUnreadCount(count ?? 0)
    }
    fetchUnread()
  }, [student.id, supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.replace('/student/login')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="md:hidden" /> {/* spacer for mobile menu button */}
      <div className="hidden md:block">
        <p className="text-sm font-semibold text-gray-900">Welcome, {student.full_name.split(' ')[0]} 👋</p>
      </div>
      <div className="flex items-center gap-3">
        <a
          href="/student/support"
          className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </a>
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-sm font-bold text-blue-700">
            {student.full_name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  )
}

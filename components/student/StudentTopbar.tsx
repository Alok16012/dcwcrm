'use client'
import { Bell, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUIStore } from '@/store/useUIStore'

interface StudentInfo {
  id: string
  full_name: string
  enrollment_number: string
  profile_photo_url: string | null
  course_name: string | null
}

const PAGE_TITLES: Record<string, string> = {
  '/student/dashboard': 'Dashboard',
  '/student/admission': 'My Admission',
  '/student/accounts':  'Accounts',
  '/student/materials': 'Study Materials',
  '/student/support':   'Help & Support',
  '/student/profile':   'My Profile',
}

export function StudentTopbar({ student }: { student: StudentInfo }) {
  const supabase = createClient()
  const pathname = usePathname()
  const { setMobileSidebarOpen } = useUIStore()
  const [unreadCount, setUnreadCount] = useState(0)

  const title = PAGE_TITLES[pathname] ?? 'Portal'
  const initials = student.full_name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

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

  return (
    <header className="h-14 bg-white/75 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between px-3 md:px-6 shrink-0 z-20">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden p-2 -ml-1 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h2 className="text-[15px] font-bold text-gray-900 leading-tight">{title}</h2>
          <p className="text-[11px] text-gray-400 hidden md:block">
            Hi, {student.full_name.split(' ')[0]}! 👋
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/student/support"
          className="relative w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-red-500 rounded-full border-2 border-white" />
          )}
        </Link>
        <Link
          href="/student/profile"
          className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="text-[11px] font-bold text-white">{initials}</span>
        </Link>
      </div>
    </header>
  )
}

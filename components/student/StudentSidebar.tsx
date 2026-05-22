'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, GraduationCap, Wallet, BookOpen,
  HelpCircle, User, X, Menu, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface StudentInfo {
  id: string
  full_name: string
  enrollment_number: string
  profile_photo_url: string | null
  course_name: string | null
}

const NAV = [
  { label: 'Dashboard', href: '/student/dashboard', icon: Home },
  { label: 'My Admission', href: '/student/admission', icon: GraduationCap },
  { label: 'Accounts', href: '/student/accounts', icon: Wallet },
  { label: 'Study Materials', href: '/student/materials', icon: BookOpen },
  { label: 'Help & Support', href: '/student/support', icon: HelpCircle },
  { label: 'My Profile', href: '/student/profile', icon: User },
]

export function StudentSidebar({ student }: { student: StudentInfo }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.replace('/student/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight truncate">DCW Portal</p>
            <p className="text-xs text-blue-600 font-medium truncate">{student.enrollment_number}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className={cn('h-4.5 w-4.5 shrink-0', active ? 'text-blue-600' : 'text-gray-400')} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Student info + logout */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-blue-700">
              {student.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{student.full_name}</p>
            {student.course_name && (
              <p className="text-xs text-gray-400 truncate">{student.course_name}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-56 shrink-0 flex-col h-full">
        <SidebarContent />
      </div>

      {/* Mobile toggle button */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 bg-white border border-gray-200 rounded-xl p-2 shadow-sm"
        onClick={() => setMobileOpen(v => !v)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileOpen(false)} />
          <div className="md:hidden fixed left-0 top-0 h-full w-64 z-50 shadow-xl">
            <SidebarContent />
          </div>
        </>
      )}
    </>
  )
}

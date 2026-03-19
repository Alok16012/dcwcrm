'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users, BookOpen, GraduationCap, DollarSign,
  UserCheck, BarChart3, Settings, ChevronLeft,
  ChevronRight, Building2, Home, ListTree,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/useUIStore'
import type { UserRole } from '@/types/app.types'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'telecaller', 'backend', 'finance'] },
  { label: 'Leads', href: '/leads', icon: Users, roles: ['admin', 'telecaller', 'backend'] },
  { label: 'Backend', href: '/backend', icon: GraduationCap, roles: ['admin', 'backend'] },
  { label: 'Finance', href: '/finance', icon: DollarSign, roles: ['admin', 'finance'] },
  { label: 'HRMS', href: '/hrms', icon: UserCheck, roles: ['admin'] },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['admin', 'backend', 'finance'] },
  { label: 'Courses', href: '/settings/courses', icon: BookOpen, roles: ['admin'] },
  { label: 'Departments', href: '/settings/departments', icon: Building2, roles: ['admin'] },
  { label: 'Sessions', href: '/settings/sessions', icon: ListTree, roles: ['admin'] },
  { label: 'Form Fields', href: '/settings/form-fields', icon: ListTree, roles: ['admin'] },
  { label: 'Settings', href: '/settings/users', icon: Settings, roles: ['admin'] },
]

interface SidebarProps {
  role: UserRole
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-gray-900 text-white transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Distance Courses Wala" className="w-8 h-8 rounded-lg bg-white" />
            <div className="flex flex-col">
              <span className="font-bold text-xs leading-tight">Distance Courses</span>
              <span className="text-[10px] text-blue-400 font-medium leading-tight">Wala.com</span>
            </div>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-gray-700 transition-colors ml-auto"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

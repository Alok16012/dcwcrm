'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users, BookOpen, GraduationCap, DollarSign,
  UserCheck, BarChart3, Settings, ChevronLeft,
  ChevronRight, Building2, Home, ListTree,
  Gift, TrendingUp, X, Scale,
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
  { label: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'lead', 'backend'] },
  { label: 'Leads', href: '/leads', icon: Users, roles: ['admin', 'lead', 'backend'] },
  { label: 'Students', href: '/backend', icon: GraduationCap, roles: ['admin', 'backend'] },
  { label: 'Finance', href: '/finance', icon: DollarSign, roles: ['admin', 'backend'] },
  { label: 'HRMS', href: '/hrms', icon: UserCheck, roles: ['admin', 'backend'] },
  { label: 'Departments', href: '/settings/departments', icon: Building2, roles: ['admin'] },
  { label: 'Courses', href: '/settings/courses', icon: BookOpen, roles: ['admin'] },
  { label: 'Sessions', href: '/settings/sessions', icon: ListTree, roles: ['admin'] },
  { label: 'Litigation', href: '/litigation', icon: Scale, roles: ['admin'] },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['admin', 'backend'] },
  { label: 'Settings', href: '/settings/users', icon: Settings, roles: ['admin'] },
  // Lead specific items kept at the end
  { label: 'Incentive', href: '/incentive', icon: Gift, roles: ['lead'] },
  { label: 'Performance', href: '/performance', icon: TrendingUp, roles: ['lead'] },
]

interface SidebarProps {
  role: UserRole
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  function NavLinks({ collapsed = false, onNavClick }: { collapsed?: boolean; onNavClick?: () => void }) {
    return (
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <div
        className={cn(
          'hidden md:flex flex-col h-full bg-gray-900 text-white transition-all duration-300 flex-shrink-0',
          sidebarCollapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <img src="/brand-logo.png" alt="Distance Courses Wala" className="w-10 h-10 rounded" />
              <div className="flex flex-col justify-center">
                <span className="font-bold text-xs leading-tight">Distance Courses</span>
                <span className="text-[10px] text-blue-400 font-bold leading-tight uppercase tracking-wider mt-0.5">Wala</span>
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
        <NavLinks collapsed={sidebarCollapsed} />
      </div>

      {/* Mobile drawer overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Drawer panel */}
          <div className="absolute left-0 top-0 h-full w-72 flex flex-col bg-gray-900 text-white shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <img src="/brand-logo.png" alt="Distance Courses Wala" className="w-9 h-9 rounded" />
                <div className="flex flex-col justify-center">
                  <span className="font-bold text-sm leading-tight">Distance Courses</span>
                  <span className="text-[10px] text-blue-400 font-bold leading-tight uppercase tracking-wider mt-0.5">Wala</span>
                </div>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 rounded hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <NavLinks onNavClick={() => setMobileSidebarOpen(false)} />
            <div className="p-4 border-t border-gray-700 text-center text-xs text-gray-500">
              Developed by <span className="text-blue-400 font-semibold">Blinks AI</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

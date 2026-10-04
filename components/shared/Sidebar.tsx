'use client'
import { withBase } from '@/lib/base-path'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users, BookOpen, GraduationCap, DollarSign,
  UserCheck, BarChart3, Settings, ChevronLeft,
  ChevronRight, Building2, Home, ListTree,
  Gift, TrendingUp, X, Scale, ClockIcon, UserCircle2,
  Wallet, Package, Bell, User, IndianRupee, HeartHandshake, ClipboardList, School,
  Award, Truck, FileInput, CalendarClock, MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/useUIStore'
import type { UserRole } from '@/types/app.types'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: UserRole[]
  /** Also visible to users whose profile carries this module grant,
   *  regardless of role — see profiles.module_rights. */
  module?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'lead', 'backend', 'counselor'] },
  // Associate portal sub-nav (only visible to associate role)
  { label: 'Dashboard',       href: '/associate',            icon: Home,          roles: ['associate'] },
  { label: 'Leads',           href: '/associate/admissions', icon: Users,         roles: ['associate'] },
  { label: 'Students',        href: '/associate/students',   icon: GraduationCap, roles: ['associate'] },
  { label: 'Accounts',        href: '/associate/account',    icon: Wallet,        roles: ['associate'] },
  { label: 'Fees',            href: '/associate/fees',       icon: IndianRupee,   roles: ['associate'] },
  { label: 'Dispatch',        href: '/associate/dispatch',   icon: Package,       roles: ['associate'] },
  { label: 'Resources',       href: '/associate/resources',  icon: BookOpen,      roles: ['associate'] },
  { label: 'Help & Support',  href: '/associate/support',    icon: HeartHandshake,roles: ['associate'] },
  { label: 'Notifications',   href: '/associate/notifications', icon: Bell,       roles: ['associate'] },
  { label: 'Profile',         href: '/associate/profile',    icon: User,          roles: ['associate'] },
  { label: 'Leads', href: '/leads', icon: Users, roles: ['admin', 'lead', 'backend', 'counselor'] },
  { label: 'WhatsApp Bot', href: '/whatsapp', icon: MessageCircle, roles: ['admin', 'backend', 'lead', 'counselor'] },
  { label: 'Students', href: '/backend', icon: GraduationCap, roles: ['admin', 'backend'] },
  { label: 'Centre Fee', href: '/centre-fee', icon: Building2, roles: ['admin', 'backend'] },
  { label: 'Finance', href: '/finance', icon: DollarSign, roles: ['admin', 'backend'] },
  { label: 'Targets', href: '/targets', icon: TrendingUp, roles: ['admin', 'lead', 'counselor'] },
  { label: 'Appointments', href: '/appointments', icon: CalendarClock, roles: ['admin', 'lead', 'counselor'] },
  { label: 'HRMS', href: '/hrms', icon: UserCheck, roles: ['admin', 'backend'] },
  { label: 'Attendance', href: '/attendance', icon: ClockIcon, roles: ['admin', 'backend'] },
  { label: 'My Attendance', href: '/my-attendance', icon: ClockIcon, roles: ['admin', 'backend', 'lead', 'counselor', 'housekeeping'] },
  { label: 'Departments', href: '/settings/departments', icon: Building2, roles: ['admin'] },
  { label: 'Courses', href: '/settings/courses', icon: BookOpen, roles: ['admin'], module: 'courses' },
  { label: 'Sessions', href: '/settings/sessions', icon: ListTree, roles: ['admin'], module: 'sessions' },
  { label: 'Lead Forms', href: '/settings/lead-forms', icon: FileInput, roles: ['admin', 'backend'] },
  { label: 'Litigation', href: '/litigation', icon: Scale, roles: ['admin'], module: 'litigation' },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['admin'] },
  { label: 'Associates', href: '/associates', icon: UserCircle2, roles: ['admin', 'backend', 'lead', 'counselor'] },
  { label: 'Mentorship',          href: '/mentorship',          icon: Award, roles: ['lead', 'counselor'] },
  { label: 'Mentorship',          href: '/mentorship-approvals',icon: Award, roles: ['admin'], module: 'mentorship' },
  { label: 'Fees', href: '/fee-documents', icon: IndianRupee, roles: ['admin', 'backend', 'lead', 'counselor'] },
  { label: 'Resources', href: '/resources', icon: BookOpen, roles: ['admin', 'backend', 'lead', 'counselor'] },
  { label: 'Tasks', href: '/tasks', icon: ClipboardList, roles: ['admin', 'backend', 'lead', 'counselor'] },
  { label: 'Student Portal', href: '/student-portal', icon: School, roles: ['admin', 'backend'] },
  { label: 'Dispatch', href: '/dispatch', icon: Truck, roles: ['admin', 'backend'] },
  { label: 'Push Notification', href: '/push-notification', icon: Bell, roles: ['admin', 'backend'] },
  { label: 'Settings', href: '/settings/users', icon: Settings, roles: ['admin'] },
  // Lead specific items
  { label: 'Incentive',    href: '/incentive',   icon: Gift,         roles: ['lead', 'counselor'] },
  { label: 'Performance',  href: '/performance', icon: TrendingUp,   roles: ['lead', 'counselor'] },
]

interface SidebarProps {
  role: UserRole
  moduleRights?: string[]
}

export function Sidebar({ role, moduleRights = [] }: SidebarProps) {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(role) || (item.module != null && moduleRights.includes(item.module))
  )

  function NavLinks({ collapsed = false, onNavClick }: { collapsed?: boolean; onNavClick?: () => void }) {
    return (
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          // '/associate' is the associate portal's Dashboard link, and every
          // other associate route ('/associate/students', '/associate/account',
          // ...) starts with that same prefix. Plain startsWith would keep
          // Dashboard highlighted as "active" on every one of those pages —
          // MobileBottomNav already special-cases this; match it here.
          const isActive = pathname === item.href
            || (item.href !== '/' && item.href !== '/dashboard' && item.href !== '/associate' && pathname.startsWith(item.href))
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
              <img src={withBase("/brand-logo.png")} alt="Distance Courses Wala" className="w-10 h-10 rounded" />
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

      {/* Mobile: "More" opens a bottom sheet of app tiles, like DriveWay's service grid */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-[#0f1729]/40 backdrop-blur-[2px]"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col rounded-t-[28px] bg-[#eef1fb] shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-[#d5dbea]" />
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <div>
                <p className="text-[13px] font-medium text-[#5b6478]">Distance Courses Wala</p>
                <h2 className="text-[22px] font-bold leading-tight text-[#0f1729]">All modules</h2>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_2px_10px_rgba(15,23,41,0.05)]"
              >
                <X className="w-5 h-5 text-[#0f1729]" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-x-2.5 gap-y-4 overflow-y-auto px-4 pt-2 pb-6">
              {visibleItems.map((item) => {
                const isActive = pathname === item.href
                  || (item.href !== '/' && item.href !== '/dashboard' && item.href !== '/associate' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    className="flex flex-col items-center gap-1.5 text-center"
                  >
                    <span
                      className={cn(
                        'flex aspect-square w-full items-center justify-center rounded-[20px] shadow-[0_2px_10px_rgba(15,23,41,0.05)]',
                        isActive ? 'bg-[#0b5cff] text-white' : 'bg-white text-[#0b5cff]'
                      )}
                    >
                      <item.icon className="w-6 h-6" />
                    </span>
                    <span className={cn('text-[11.5px] leading-tight', isActive ? 'font-semibold text-[#0b5cff]' : 'font-medium text-[#0f1729]')}>
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Users, GraduationCap, Award, Wallet, Truck,
  ClockIcon, MoreHorizontal, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/useUIStore'
import type { UserRole } from '@/types/app.types'

interface Item { label: string; href: string; icon: React.ElementType }

const NAV: Record<string, Item[]> = {
  admin: [
    { label: 'Home',       href: '/dashboard',  icon: Home },
    { label: 'Leads',      href: '/leads',      icon: Users },
    { label: 'Students',   href: '/backend',    icon: GraduationCap },
    { label: 'Targets',    href: '/targets',    icon: TrendingUp },
  ],
  backend: [
    { label: 'Home',     href: '/dashboard', icon: Home },
    { label: 'Leads',    href: '/leads',     icon: Users },
    { label: 'Students', href: '/backend',   icon: GraduationCap },
    { label: 'Dispatch', href: '/dispatch',  icon: Truck },
  ],
  lead: [
    { label: 'Home',       href: '/dashboard',  icon: Home },
    { label: 'Leads',      href: '/leads',      icon: Users },
    { label: 'Targets',    href: '/targets',    icon: TrendingUp },
    { label: 'Mentorship', href: '/mentorship', icon: Award },
  ],
  counselor: [
    { label: 'Home',       href: '/dashboard',  icon: Home },
    { label: 'Leads',      href: '/leads',      icon: Users },
    { label: 'Targets',    href: '/targets',    icon: TrendingUp },
    { label: 'Mentorship', href: '/mentorship', icon: Award },
  ],
  associate: [
    { label: 'Home',     href: '/associate',            icon: Home },
    { label: 'Leads',    href: '/associate/admissions', icon: Users },
    { label: 'Students', href: '/associate/students',   icon: GraduationCap },
    { label: 'Accounts', href: '/associate/account',    icon: Wallet },
  ],
  housekeeping: [
    { label: 'Attendance', href: '/attendance', icon: ClockIcon },
  ],
}

export function MobileBottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const { setMobileSidebarOpen } = useUIStore()
  const items = NAV[role] ?? NAV.admin

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && href !== '/associate' && pathname.startsWith(href))

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/85 backdrop-blur-xl border-t border-gray-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-around px-1 pt-1.5 pb-1.5">
        {items.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-xl"
            >
              <span className={cn(
                'flex items-center justify-center w-10 h-7 rounded-full transition-colors',
                active ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'text-gray-400'
              )}>
                <Icon className="w-[18px] h-[18px]" />
              </span>
              <span className={cn('text-[10px] font-semibold leading-none', active ? 'text-blue-600' : 'text-gray-400')}>
                {item.label}
              </span>
            </Link>
          )
        })}
        {/* More → opens the full sidebar drawer */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-xl"
        >
          <span className="flex items-center justify-center w-10 h-7 rounded-full text-gray-400">
            <MoreHorizontal className="w-[18px] h-[18px]" />
          </span>
          <span className="text-[10px] font-semibold leading-none text-gray-400">More</span>
        </button>
      </div>
    </nav>
  )
}

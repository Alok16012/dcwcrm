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

  // A floating pill over the content, as in the DriveWay app: no bar of its
  // own, only the pill is solid; the active item sits in a light-blue pill.
  const cell = (active: boolean) => cn(
    'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 transition-colors',
    active ? 'bg-[#e8effe] text-[#0b5cff]' : 'text-[#0f1729]'
  )

  return (
    <div
      className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3.5 pointer-events-none"
      style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}
    >
      <nav
        className="pointer-events-auto flex items-stretch rounded-full bg-white/95 p-1 backdrop-blur-xl"
        style={{ boxShadow: '0 8px 24px rgba(15,23,41,0.14)' }}
      >
        {items.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cell(active)}>
              <Icon className="w-[21px] h-[21px]" strokeWidth={active ? 2.4 : 2} />
              <span className={cn('text-[10.5px] leading-tight', active ? 'font-semibold' : 'font-medium')}>
                {item.label}
              </span>
            </Link>
          )
        })}
        {/* More → opens the full menu sheet */}
        <button onClick={() => setMobileSidebarOpen(true)} className={cell(false)}>
          <MoreHorizontal className="w-[21px] h-[21px]" strokeWidth={2} />
          <span className="text-[10.5px] font-medium leading-tight">More</span>
        </button>
      </nav>
    </div>
  )
}

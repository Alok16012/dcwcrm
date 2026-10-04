'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, CalendarCheck, CalendarDays, ClipboardCheck, Banknote, Wallet, Fingerprint, Settings, LayoutDashboard, BarChart3 } from 'lucide-react'

const TABS = [
  { href: '/hrms/overview',   label: 'Overview',   icon: LayoutDashboard, exact: false },
  { href: '/hrms',            label: 'Employees',  icon: Users,         exact: true },
  { href: '/hrms/attendance', label: 'Attendance', icon: CalendarCheck, exact: false },
  { href: '/hrms/leave',      label: 'Leave',      icon: CalendarDays,  exact: false },
  { href: '/hrms/regularization', label: 'Regularization', icon: ClipboardCheck, exact: false },
  { href: '/hrms/payroll',    label: 'Payroll',    icon: Banknote,      exact: false },
  { href: '/hrms/advances',   label: 'Advances',   icon: Wallet,        exact: false },
  { href: '/hrms/biometric',  label: 'Biometric',  icon: Fingerprint,   exact: false },
  { href: '/hrms/reports',    label: 'Reports',    icon: BarChart3,     exact: false },
  { href: '/hrms/settings',   label: 'Settings',   icon: Settings,      exact: false },
]

export default function HrmsNav() {
  const pathname = usePathname()
  return (
    <div className="no-scrollbar flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl w-fit overflow-x-auto max-w-full max-md:bg-white max-md:rounded-full max-md:shadow-[0_2px_10px_rgba(15,23,41,0.05)]">
      {TABS.map(t => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              active
                ? 'bg-white shadow-sm text-blue-700 max-md:bg-[#0b5cff] max-md:text-white max-md:shadow-none'
                : 'text-gray-500 hover:text-gray-700'
            } max-md:rounded-full`}
            // On a phone the strip scrolls; keep the current tab in view.
            ref={active ? (el) => { el?.scrollIntoView({ block: 'nearest', inline: 'center' }) } : undefined}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </Link>
        )
      })}
    </div>
  )
}

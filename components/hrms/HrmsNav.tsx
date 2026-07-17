'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, CalendarCheck, Banknote, Wallet } from 'lucide-react'

const TABS = [
  { href: '/hrms',            label: 'Employees',  icon: Users,         exact: true },
  { href: '/hrms/attendance', label: 'Attendance', icon: CalendarCheck, exact: false },
  { href: '/hrms/payroll',    label: 'Payroll',    icon: Banknote,      exact: false },
  { href: '/hrms/advances',   label: 'Advances',   icon: Wallet,        exact: false },
]

export default function HrmsNav() {
  const pathname = usePathname()
  return (
    <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl w-fit overflow-x-auto max-w-full">
      {TABS.map(t => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              active ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </Link>
        )
      })}
    </div>
  )
}

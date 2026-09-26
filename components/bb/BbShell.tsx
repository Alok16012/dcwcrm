'use client'
import { withBase } from '@/lib/base-path'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  Home, Building2, BriefcaseBusiness, Users, KanbanSquare,
  BadgeCheck, IndianRupee, Menu, X, LogOut, ChevronDown,
  Users2, CalendarCheck, Banknote, Wallet,
} from 'lucide-react'
import { BB_ROLE_LABELS, BB_MANAGER_ROLES, type BbRole } from '@/lib/bb/constants'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  /** Omitted means every BB role sees it. */
  managerOnly?: boolean
}

/** The order here is the order of the work: client → opening → people → money. */
const NAV: NavItem[] = [
  { label: 'Dashboard',  href: '/bb/dashboard',  icon: Home },
  { label: 'Companies',  href: '/bb/companies',  icon: Building2 },
  { label: 'Jobs',       href: '/bb/jobs',       icon: BriefcaseBusiness },
  { label: 'Candidates', href: '/bb/candidates', icon: Users },
  { label: 'Pipeline',   href: '/bb/pipeline',   icon: KanbanSquare },
  { label: 'Placements', href: '/bb/placements', icon: BadgeCheck },
  { label: 'Revenue',    href: '/bb/revenue',    icon: IndianRupee, managerOnly: true },
  { label: 'Candidate Fees', href: '/bb/fees',   icon: Wallet },
  { label: 'Attendance', href: '/bb/attendance', icon: CalendarCheck },
  { label: 'Payroll',    href: '/bb/payroll',    icon: Banknote,    managerOnly: true },
  { label: 'Team',       href: '/bb/team',       icon: Users2,      managerOnly: true },
]

interface Props {
  fullName: string
  email: string
  role: string
  children: React.ReactNode
}

export default function BbShell({ fullName, email, role, children }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const isManager = BB_MANAGER_ROLES.includes(role)
  const items = NAV.filter(i => !i.managerOnly || isManager)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.replace(withBase('/login'))
  }

  const initials = fullName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {items.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-100/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <item.icon className="w-[18px] h-[18px] shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  const brandHeader = (
    <div className="flex items-center gap-2.5 px-5 h-16 shrink-0 border-b border-white/10">
      <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden p-1">
        <Image src={withBase("/bb-mark.png")} alt="" width={32} height={32} className="w-full h-full object-contain" />
      </div>
      <div className="min-w-0">
        <p className="font-bold text-white text-sm leading-tight truncate">Berojgar Bharat</p>
        <p className="text-[11px] text-emerald-200/60 leading-tight">Recruitment CRM</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-clip bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-slate-900">
        {brandHeader}
        {nav}
        <div className="px-3 py-3 border-t border-white/10">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-emerald-100/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 flex flex-col bg-slate-900">
            <div className="flex items-center justify-between">
              {brandHeader}
              <button onClick={() => setMobileOpen(false)} className="p-4 text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {nav}
            <div className="px-3 py-3 border-t border-white/10">
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-emerald-100/60 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="w-[18px] h-[18px]" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden md:block" />

          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-2.5 hover:bg-gray-100 transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                {initials || 'BB'}
              </span>
              <span className="hidden sm:block text-left">
                <span className="block text-sm font-semibold text-gray-900 leading-tight">{fullName}</span>
                <span className="block text-[11px] text-gray-500 leading-tight">
                  {BB_ROLE_LABELS[role as BbRole] ?? role}
                </span>
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">{fullName}</p>
                    <p className="text-xs text-gray-500 truncate">{email}</p>
                  </div>
                  <button
                    onClick={signOut}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}

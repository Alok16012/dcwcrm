'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Search, Bell, Star, CalendarClock, IndianRupee, ArrowRight, LayoutGrid, Phone, TrendingUp,
} from 'lucide-react'
import { visibleNavItems } from '@/components/shared/Sidebar'
import { useUIStore } from '@/store/useUIStore'
import type { UserRole } from '@/types/app.types'

/*
 * The phone home screen, laid out like the DriveWay app's home: greeting and a
 * big question, a "map" hero with today's numbers pinned on it under a search
 * sheet, a summary card, a service-style grid of modules and a promo banner.
 * Phone width only — the desktop dashboard is untouched.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

// Tile tints, cycled across the module grid (soft background + strong glyph).
const TINTS = [
  { bg: '#e8effe', fg: '#0b5cff' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#fff6e4', fg: '#dd8f0d' },
  { bg: '#f5f3ff', fg: '#7c3aed' },
  { bg: '#e6fffa', fg: '#0d9488' },
  { bg: '#fee2e2', fg: '#dc2626' },
  { bg: '#fff3e0', fg: '#e07b1f' },
  { bg: '#dce9fd', fg: '#0847c7' },
]

// The bottom nav already has these one tap away.
const IN_BOTTOM_NAV = new Set(['/dashboard', '/associate'])

function greeting() {
  // Office time is IST whatever the device clock zone.
  const h = (new Date().getUTCHours() + 5.5 + 24) % 24
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export interface MobileHomeProps {
  name: string
  role: UserRole
  moduleRights: string[]
  isLead: boolean
  newToday: number
  followupsToday: number
  todayAppointments: number
  convertedThisMonth: number
  todaysCollection: number
  todaysCollectionCount: number
  outstandingFees: number
}

export function MobileHome(p: MobileHomeProps) {
  const router = useRouter()
  const { setMobileSidebarOpen } = useUIStore()
  const [q, setQ] = useState('')
  const firstName = p.name.trim().split(/\s+/)[0] || 'there'

  const modules = visibleNavItems(p.role, p.moduleRights).filter(m => !IN_BOTTOM_NAV.has(m.href))
  const tiles = modules.slice(0, 7)

  return (
    <div className="md:hidden space-y-5 pb-1">
      {/* Greeting */}
      <div>
        <p className="text-[14px] font-medium text-[#5b6478]">{greeting()}, {firstName} 👋</p>
        <h1 data-size="hero" className="text-[26px] font-extrabold leading-tight tracking-tight text-[#0f1729]">What&apos;s on today?</h1>
      </div>

      {/* Hero: a "map" of today with the numbers pinned on it, search sheet on top */}
      <div>
        <div className="relative h-[176px] overflow-hidden rounded-[22px] bg-[#e9edf7]">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 176" preserveAspectRatio="none" aria-hidden>
            <circle cx="290" cy="150" r="60" fill="#cdebd9" />
            <circle cx="40" cy="-10" r="40" fill="#cdebd9" />
            {[50, 120, 230, 300].map(x => <rect key={x} x={x} y="0" width="9" height="176" fill="#fff" />)}
            {[50, 110].map(y => <rect key={y} x="0" y={y} width="360" height="9" fill="#fff" />)}
            <path d="M0 150 L360 20" stroke="#fff" strokeWidth="10" />
            <path d="M0 150 L360 20" stroke="#f5a623" strokeWidth="1.5" strokeDasharray="7 7" />
            <path d="M0 80 L360 80" stroke="#f5a623" strokeWidth="1.5" strokeDasharray="7 7" opacity="0.6" />
          </svg>
          <Link href="/leads" className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-[0_2px_10px_rgba(15,23,41,0.08)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#2f9e76] ring-4 ring-[#2f9e76]/15" />
            <span className="text-[13px] font-semibold text-[#0f1729]">{p.newToday} new lead{p.newToday === 1 ? '' : 's'} today</span>
          </Link>
          <Link href="/leads?followup=today" className="absolute right-4 top-14 flex items-center gap-1.5 rounded-full bg-[#f5a623] px-2.5 py-1 shadow-md">
            <Bell className="h-3.5 w-3.5 text-white" />
            <span className="text-[12px] font-bold text-white">{p.followupsToday}</span>
          </Link>
          <Link href="/appointments" className="absolute left-[38%] top-[52%] flex items-center gap-1.5 rounded-full bg-[#0b5cff] px-2.5 py-1 shadow-md ring-4 ring-[#0b5cff]/15">
            <CalendarClock className="h-3.5 w-3.5 text-white" />
            <span className="text-[12px] font-bold text-white">{p.todayAppointments}</span>
          </Link>
        </div>

        <div className="relative z-10 mx-2.5 -mt-12 rounded-[22px] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,41,0.10)]">
          <form
            onSubmit={e => { e.preventDefault(); router.push(q.trim() ? `/leads?q=${encodeURIComponent(q.trim())}` : '/leads') }}
            className="flex items-center gap-2.5 rounded-2xl bg-[#f3f5fb] px-3.5 py-3"
          >
            <Search className="h-5 w-5 flex-shrink-0 text-[#0f1729]" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search leads…"
              enterKeyHint="search"
              data-bare
              className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#0f1729] placeholder:text-[#0f1729] placeholder:font-semibold focus:outline-none"
            />
            <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-[#5b6478]">Today</span>
          </form>
          <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto">
            {[
              { href: '/leads?followup=today', label: 'Followups', Icon: Bell },
              { href: '/leads?status=interested', label: 'Interested', Icon: Star },
              { href: '/appointments', label: 'Appointments', Icon: CalendarClock },
              { href: '/targets', label: 'Targets', Icon: TrendingUp },
            ].map(({ href, label, Icon }) => (
              <Link key={href} href={href} className="flex flex-shrink-0 items-center gap-2 rounded-2xl border border-[#e6eaf5] px-3.5 py-2">
                <Icon className="h-4 w-4 text-[#0b5cff]" />
                <span className="text-[13.5px] font-semibold text-[#0f1729]">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Summary card (DriveWay's "Vehicle type" row) */}
      {p.isLead ? (
        <Link href="/targets" className="flex items-center justify-between rounded-[22px] bg-white px-4 py-3.5 shadow-[0_2px_10px_rgba(15,23,41,0.05)]">
          <div>
            <p className="text-[15px] font-bold text-[#0f1729]">Converted this month</p>
            <p className="text-[12.5px] text-[#5b6478]">Track it against your target</p>
          </div>
          <span className="rounded-full bg-[#0b5cff] px-4 py-2 text-[15px] font-bold text-white">{p.convertedThisMonth}</span>
        </Link>
      ) : (
        <Link href="/finance" className="flex items-center justify-between rounded-[22px] bg-white px-4 py-3.5 shadow-[0_2px_10px_rgba(15,23,41,0.05)]">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-[#0f1729]">Today&apos;s collection</p>
            <p className="text-[12.5px] text-[#5b6478]">
              {p.todaysCollectionCount} payment{p.todaysCollectionCount === 1 ? '' : 's'} · {fmt(p.outstandingFees)} outstanding
            </p>
          </div>
          <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-[#0b5cff] px-3.5 py-2 text-[15px] font-bold text-white">
            <IndianRupee className="h-4 w-4" />{p.todaysCollection.toLocaleString('en-IN')}
          </span>
        </Link>
      )}

      {/* Module grid (DriveWay's "Our Services") */}
      <div>
        <p className="text-[14px] font-medium text-[#5b6478]">Jump back in</p>
        <h2 className="mb-3 text-[22px] font-bold tracking-tight text-[#0f1729]">Your Modules</h2>
        <div className="grid grid-cols-4 gap-x-2.5 gap-y-3.5">
          {tiles.map((m, i) => {
            const t = TINTS[i % TINTS.length]
            return (
              <Link key={m.href} href={m.href} className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className="flex aspect-square w-full items-center justify-center rounded-[20px] bg-white shadow-[0_2px_10px_rgba(15,23,41,0.06)]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: t.bg }}>
                    <m.icon className="h-6 w-6" style={{ color: t.fg }} />
                  </span>
                </span>
                <span className="text-[12px] font-medium leading-tight text-[#0f1729]">{m.label}</span>
              </Link>
            )
          })}
          <button onClick={() => setMobileSidebarOpen(true)} className="flex flex-col items-center gap-1.5 text-center">
            <span className="flex aspect-square w-full items-center justify-center rounded-[20px] bg-white shadow-[0_2px_10px_rgba(15,23,41,0.06)]">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f1729]">
                <LayoutGrid className="h-6 w-6 text-white" />
              </span>
            </span>
            <span className="text-[12px] font-medium leading-tight text-[#0f1729]">All</span>
          </button>
        </div>
      </div>

      {/* Promo-style banner */}
      <Link
        href="/leads?followup=today"
        className="relative block overflow-hidden rounded-[22px] p-5 text-white"
        style={{ background: 'linear-gradient(135deg,#0b5cff 0%,#04246b 100%)' }}
      >
        <span className="absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/10" />
        <span className="absolute right-10 -bottom-10 h-24 w-24 rounded-full bg-[#f5a623]/30" />
        <span className="inline-block rounded-full bg-[#f5a623] px-2.5 py-0.5 text-[11px] font-bold text-[#04246b]">TODAY</span>
        <p className="mt-2 text-[22px] font-extrabold leading-tight">
          {p.followupsToday} follow-up{p.followupsToday === 1 ? '' : 's'}
          <br />waiting for a call
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-bold text-[#0b5cff]">
          <Phone className="h-3.5 w-3.5" /> Call now <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>

      <div>
        <p className="text-[14px] font-medium text-[#5b6478]">Numbers</p>
        <h2 className="text-[22px] font-bold tracking-tight text-[#0f1729]">At a glance</h2>
      </div>
    </div>
  )
}

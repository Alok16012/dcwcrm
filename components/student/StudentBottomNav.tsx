'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, GraduationCap, Wallet, BookOpen, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/useUIStore'

const ITEMS = [
  { label: 'Home',      href: '/student/dashboard', icon: Home },
  { label: 'Admission', href: '/student/admission', icon: GraduationCap },
  { label: 'Accounts',  href: '/student/accounts',  icon: Wallet },
  { label: 'Materials', href: '/student/materials', icon: BookOpen },
]

export function StudentBottomNav() {
  const pathname = usePathname()
  const { setMobileSidebarOpen } = useUIStore()

  const isActive = (href: string) =>
    pathname === href || (href !== '/student/dashboard' && pathname.startsWith(href))

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/85 backdrop-blur-xl border-t border-gray-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-around px-1 pt-1.5 pb-1.5">
        {ITEMS.map(({ label, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href} className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1">
              <span className={cn('flex items-center justify-center w-10 h-7 rounded-full transition-colors',
                active ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'text-gray-400')}>
                <Icon className="w-[18px] h-[18px]" />
              </span>
              <span className={cn('text-[10px] font-semibold leading-none', active ? 'text-blue-600' : 'text-gray-400')}>{label}</span>
            </Link>
          )
        })}
        <button onClick={() => setMobileSidebarOpen(true)} className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1">
          <span className="flex items-center justify-center w-10 h-7 rounded-full text-gray-400">
            <MoreHorizontal className="w-[18px] h-[18px]" />
          </span>
          <span className="text-[10px] font-semibold leading-none text-gray-400">More</span>
        </button>
      </div>
    </nav>
  )
}

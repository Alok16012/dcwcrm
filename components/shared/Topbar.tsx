'use client'
import { withBase } from '@/lib/base-path'
import { LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types/app.types'
import { NotificationBell } from './NotificationBell'

interface TopbarProps {
  user: Profile
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-16 md:h-14 bg-transparent md:bg-white/75 md:backdrop-blur-xl md:border-b md:border-gray-100 flex items-center justify-between px-4 md:px-5 flex-shrink-0 z-20">
      {/* Mobile: brand lockup, as in the DriveWay app — the menu lives under "More" in the bottom nav */}
      <div className="flex items-center gap-2.5 md:hidden">
        <img src={withBase("/brand-logo.png")} alt="" className="w-10 h-10 rounded-xl" />
        <div className="flex flex-col leading-none">
          <span className="text-[16px] font-extrabold tracking-tight text-[#0f1729] whitespace-nowrap">
            Distance Courses <span className="text-[#0b5cff]">Wala</span>
          </span>
          <span className="mt-1 text-[9.5px] font-semibold tracking-[0.18em] text-[#5b6478]">CRM</span>
        </div>
      </div>

      {/* Desktop: spacer */}
      <div className="hidden md:block" />

      <div className="flex items-center gap-1.5">
        <NotificationBell userId={user.id} role={user.role} />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl px-1.5 md:px-2 py-1 text-sm hover:bg-gray-100 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm shadow-blue-200">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium hidden md:block">{user.full_name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-xs text-gray-500 cursor-default">
              {user.full_name}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-gray-400 cursor-default -mt-1">
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

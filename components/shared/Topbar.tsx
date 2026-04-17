'use client'
import { LogOut, Menu } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/store/useUIStore'
import type { Profile } from '@/types/app.types'

interface TopbarProps {
  user: Profile
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter()
  const supabase = createClient()
  const { toggleMobileSidebar } = useUIStore()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3 md:px-4 flex-shrink-0">
      {/* Mobile: hamburger + brand name */}
      <div className="flex items-center gap-2 md:hidden">
        <button
          onClick={toggleMobileSidebar}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors -ml-1"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/brand-logo.png" alt="" className="w-7 h-7 rounded" />
          <span className="font-semibold text-sm text-gray-800 leading-tight">Distance Courses</span>
        </div>
      </div>

      {/* Desktop: spacer */}
      <div className="hidden md:block" />

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-100 transition-colors">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm hidden md:block">{user.full_name}</span>
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

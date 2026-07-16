'use client'
import { LogOut, Menu, MessageCircle, Instagram, Facebook, Youtube } from 'lucide-react'
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
import { NotificationBell } from './NotificationBell'

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
    <header className="h-14 bg-white/75 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between px-3 md:px-5 flex-shrink-0 z-20">
      {/* Mobile: hamburger + brand name */}
      <div className="flex items-center gap-2 md:hidden">
        <button
          onClick={toggleMobileSidebar}
          className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors -ml-1"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/brand-logo.png" alt="" className="w-7 h-7 rounded-lg" />
          <span className="font-bold text-sm text-gray-900 leading-tight">Distance Courses</span>
        </div>
      </div>

      {/* Desktop: spacer */}
      <div className="hidden md:block" />

      <div className="flex items-center gap-1.5">
        <a
          href="https://wa.me/919149406965"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 transition-colors"
          aria-label="WhatsApp 9149406965"
          title="WhatsApp: 9149406965"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="hidden md:block">9149406965</span>
        </a>
        <div className="hidden sm:flex items-center gap-0.5">
          <a
            href="https://www.instagram.com/sheraatravels"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl text-pink-600 hover:bg-pink-50 transition-colors"
            aria-label="Instagram"
            title="Instagram"
          >
            <Instagram className="w-5 h-5" />
          </a>
          <a
            href="https://www.facebook.com/sheratravelssxr"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors"
            aria-label="Facebook"
            title="Facebook"
          >
            <Facebook className="w-5 h-5" />
          </a>
          <a
            href="https://www.youtube.com/@Sheratravels"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
            aria-label="YouTube"
            title="YouTube"
          >
            <Youtube className="w-5 h-5" />
          </a>
        </div>
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

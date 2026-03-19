import { createServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/shared/Sidebar'
import { Topbar } from '@/components/shared/Topbar'
import type { UserRole, Profile } from '@/types/app.types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  let userProfile: Profile = {
    id: '',
    email: session?.user?.email ?? '',
    full_name: 'Admin',
    role: 'admin' as UserRole,
    is_active: true,
    created_at: new Date().toISOString(),
  }

  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single() as { data: { id: string; email: string; full_name: string; role: string; phone: string | null; is_active: boolean; created_at: string } | null }

    if (profile) {
      userProfile = {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role as UserRole,
        phone: profile.phone ?? undefined,
        is_active: profile.is_active,
        created_at: profile.created_at,
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar role={userProfile.role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar user={userProfile} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

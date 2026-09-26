import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import BbShell from '@/components/bb/BbShell'
import { isBbRole } from '@/lib/bb/constants'

/**
 * Berojgar Bharat area.
 *
 * The middleware already keeps DCW accounts out, but the guard is repeated
 * here: a layout that renders on a bad session is one misconfigured matcher
 * away from leaking another company's data.
 */
export default async function BbLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = (await supabase
    .from('profiles')
    .select('full_name, email, role, is_active')
    .eq('id', user.id)
    .single()) as {
      data: { full_name: string; email: string; role: string; is_active: boolean } | null
    }

  if (!profile || !isBbRole(profile.role)) redirect('/dashboard')
  if (!profile.is_active) redirect('/login')

  return (
    <BbShell
      fullName={profile.full_name}
      email={profile.email}
      role={profile.role}
    >
      {children}
    </BbShell>
  )
}

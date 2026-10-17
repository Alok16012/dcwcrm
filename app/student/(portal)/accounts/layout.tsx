import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Students who came through an associate have no fee pages in the portal.
export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/student/login')

  const { data: student } = await supabase
    .from('students')
    .select('referred_by_associate')
    .eq('portal_user_id', user.id)
    .single()

  if ((student as { referred_by_associate: string | null } | null)?.referred_by_associate) redirect('/student/dashboard')
  return <>{children}</>
}

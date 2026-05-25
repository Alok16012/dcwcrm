import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { StudentPortalManager } from '@/app/(dashboard)/admin/tabs/StudentPortalManager'

export default async function StudentPortalPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (!profile || !['admin', 'backend'].includes(profile.role)) redirect('/dashboard')

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Portal</h1>
        <p className="text-sm text-gray-500 mt-1">Manage student portal credentials, status updates, and notifications</p>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2 inline-block">
          ⚠️ Admin view — Students see only their own data when they log in at <strong>/student/login</strong>
        </p>
      </div>
      <StudentPortalManager />
    </div>
  )
}

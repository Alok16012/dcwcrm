import { redirect } from 'next/navigation'
import { createServerClient, getCurrentProfile } from '@/lib/supabase/server'
import { lmsDb } from './shared'

/** Gate for the staff LMS pages: admin / backend, or the 'lms' module grant. */
export async function requireLmsManager() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  const allowed = ['admin', 'backend'].includes(profile.role) || (profile.module_rights ?? []).includes('lms')
  if (!allowed) redirect('/dashboard')
  const supabase = await createServerClient()
  return { profile, db: lmsDb(supabase) }
}

/** The signed-in student (portal login), or a redirect to the student login. */
export async function requireStudent() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/student/login')
  const db = lmsDb(supabase)
  const { data: student } = await db
    .from('students')
    .select('id, full_name, course_id, sub_course_id')
    .eq('portal_user_id', user.id)
    .single()
  if (!student) redirect('/student/login')
  return { student: student as { id: string; full_name: string; course_id: string | null; sub_course_id: string | null }, db }
}

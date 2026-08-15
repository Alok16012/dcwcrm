import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoursesClient } from './client'

export default async function CoursesPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, module_rights').eq('id', user.id).single() as { data: { role: string; module_rights: string[] | null } | null }
  if (!profile || (!['admin', 'associate'].includes(profile.role) && !(profile.module_rights ?? []).includes('courses'))) redirect('/')

  const { data: courses } = await supabase.from('courses').select('*, sub_courses(*)').order('name')

  return <CoursesClient courses={courses ?? []} />
}

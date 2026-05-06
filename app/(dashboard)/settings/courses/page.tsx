import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoursesClient } from './client'

export default async function CoursesPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null }
  if (!profile || !['admin', 'accounts'].includes(profile.role)) redirect('/')

  const { data: courses } = await supabase.from('courses').select('*, sub_courses(*)').order('name')

  return <CoursesClient courses={courses ?? []} />
}

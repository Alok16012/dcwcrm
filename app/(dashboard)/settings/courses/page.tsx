import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoursesClient } from './client'

export default async function CoursesPage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null }
  if (profile?.role !== 'admin') redirect('/')

  const { data: courses } = await supabase.from('courses').select('*, sub_courses(*)').order('name')

  return <CoursesClient courses={courses ?? []} />
}

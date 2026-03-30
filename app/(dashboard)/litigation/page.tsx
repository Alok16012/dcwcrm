import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LitigationClient } from './client'

export const dynamic = 'force-dynamic'

export default async function LitigationPage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: departments }, { data: subSections }, { data: sessions }, { data: litigations }] = await Promise.all([
    supabase.from('departments').select('id, name, dept_fund').order('name'),
    supabase.from('department_sub_sections').select('id, name, department_id').order('name'),
    supabase.from('sessions').select('id, name').order('name'),
    supabase
      .from('department_litigations')
      .select(`*, department:departments(id,name), sub_section:department_sub_sections(id,name), session:sessions(id,name)`)
      .order('created_at', { ascending: false }),
  ])

  return (
    <LitigationClient
      departments={(departments ?? []) as any}
      subSections={subSections ?? []}
      sessions={sessions ?? []}
      initialLitigations={(litigations ?? []) as any}
    />
  )
}

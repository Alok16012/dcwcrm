import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DepartmentsClient } from './client'

export default async function DepartmentsPage() {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) redirect('/login')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null }
    if (profile?.role !== 'admin') redirect('/')

    const { data: departments } = await supabase.from('departments').select('*, department_sub_sections(*)').order('name')

    return <DepartmentsClient departments={departments ?? []} />
}

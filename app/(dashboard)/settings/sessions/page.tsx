import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SessionsClient } from './client'

export default async function SessionsPage() {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) redirect('/login')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null }
    if (profile?.role !== 'admin') redirect('/')

    const { data: sessions } = await supabase.from('sessions').select('*').order('created_at', { ascending: false })

    return <SessionsClient sessions={sessions ?? []} />
}

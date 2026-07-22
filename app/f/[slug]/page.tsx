import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { PublicLeadForm, type PublicForm } from '@/components/public/PublicLeadForm'

export const dynamic = 'force-dynamic'

function getForm(slug: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  return supabase
    .from('lead_capture_forms')
    .select('slug, title, subtitle, fields, success_message, is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = await getForm(slug)
  const title = (data as { title?: string } | null)?.title
  return {
    title: title ? `${title} — Distance Courses Wala` : 'Distance Courses Wala',
    description: (data as { subtitle?: string } | null)?.subtitle ?? 'Apply now with Distance Courses Wala',
    robots: { index: false, follow: false },
  }
}

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: form } = await getForm(slug)
  if (!form) notFound()
  return <PublicLeadForm form={form as unknown as PublicForm} />
}

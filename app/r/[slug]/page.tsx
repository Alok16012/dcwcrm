import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { ReviewQrLanding } from '@/components/public/ReviewQrLanding'
import type { PublicReviewPage } from '@/lib/review-qr'

// Where a Review QR lands (no login). Built in /review-qr, migration 122.
export const dynamic = 'force-dynamic'

function getPage(slug: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  return supabase
    .from('review_qr_pages')
    .select('slug, business_name, tagline, google_review_url, categories')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = await getPage(slug)
  const name = (data as { business_name?: string } | null)?.business_name
  return {
    title: name ? `Review ${name} on Google` : 'Leave a review',
    robots: { index: false, follow: false },
  }
}

export default async function ReviewQrPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data } = await getPage(slug)
  if (!data) notFound()
  return <ReviewQrLanding page={data as unknown as PublicReviewPage} />
}

// Review QR (migration 122): shared by the admin page (/review-qr) and the
// public page customers land on after scanning (/r/{slug}).
import { APP_URL } from '@/lib/branding'

export interface ReviewCategory {
  id: string
  name: string
  reviews: string[]
}

export interface ReviewQrPage {
  id: string
  slug: string
  business_name: string
  tagline: string | null
  google_review_url: string
  categories: ReviewCategory[]
  is_active: boolean
  scan_count: number
  copy_count: number
  google_open_count: number
  created_at: string
}

/** What the public page needs — no counters or ids. */
export type PublicReviewPage = Pick<ReviewQrPage, 'slug' | 'business_name' | 'tagline' | 'google_review_url' | 'categories'>

/**
 * The link that opens Google's "write a review" box. Admin may paste the
 * profile's own review link (g.page/r/…/review) or just a Place ID.
 */
export function googleReviewLink(value: string): string {
  const v = value.trim()
  if (/^https?:\/\//i.test(v)) return v
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(v)}`
}

/** Looks like something googleReviewLink can open. */
export function isGoogleReviewValue(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (/^https?:\/\//i.test(v)) return /google\.|g\.page|goo\.gl|maps\.app/i.test(v)
  return /^[A-Za-z0-9_-]{10,}$/.test(v)
}

/** The URL inside the QR code. */
export function publicReviewUrl(slug: string, origin?: string): string {
  const base = origin && origin.includes('localhost') ? `${origin}/crm` : APP_URL
  return `${base}/r/${slug}`
}

export function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export const newId = () => Math.random().toString(36).slice(2, 10)

/**
 * Starter reviews for an education business, to edit or replace. Kept varied
 * on purpose: many identical reviews get filtered out by Google.
 */
export const SAMPLE_CATEGORIES: Omit<ReviewCategory, 'id'>[] = [
  {
    name: 'Admission Process',
    reviews: [
      'The admission process was smooth and quick. The team guided me through every step and handled all my documents carefully.',
      'I completed my admission without any stress. Every step was explained clearly and everything was done on time.',
      'My admission was confirmed within a few days. The process was transparent and they kept me informed throughout.',
      'A very easy admission experience. I didn’t have to run around anywhere; the team took care of everything.',
      'I had enquired at several places, and this was by far the simplest and most reliable admission process.',
      'Quick, honest and hassle-free. They explained the eligibility and required documents clearly before we started.',
      'From filling in the form to the final confirmation, everything was handled professionally.',
      'I was able to complete my entire admission from home. The team was extremely cooperative.',
    ],
  },
  {
    name: 'Counselling & Guidance',
    reviews: [
      'The counsellor took the time to understand my situation and recommended the right course for me.',
      'Excellent counselling. I received clear guidance on choosing the right board and course.',
      'They gave honest advice rather than simply pushing a course. I truly appreciated the genuine guidance.',
      'Patient and thorough counselling. All my questions about the course, exams and recognition were answered.',
      'As a working professional, I needed flexibility, and they suggested the perfect option for me.',
      'Great career guidance. The counsellor walked me through every option with its pros and cons.',
      'A very supportive counselling team. Whenever I called, I got a clear and helpful answer.',
    ],
  },
  {
    name: 'Staff & Service',
    reviews: [
      'Very polite and friendly staff. They respond quickly and treat every student with respect.',
      'The staff are courteous and always reply promptly, whether by phone or WhatsApp.',
      'A supportive team that genuinely cares about its students. I never felt ignored.',
      'Everyone at the office was helpful and patient with all my questions. A great team.',
      'Friendly and professional from the very first conversation. I trusted them immediately.',
      'Prompt support and a very respectful team. Thank you for all your help.',
      'The staff explained everything calmly and followed up on their own. Very professional.',
    ],
  },
  {
    name: 'Fees & Transparency',
    reviews: [
      'The fees were reasonable and everything was explained upfront. No hidden charges at all.',
      'A clear fee structure with no surprises, and I received a receipt for every payment.',
      'Affordable fees with flexible payment options. Completely transparent about every charge.',
      'Proper receipts for every payment and no unexpected costs later. An honest institute.',
      'All fee details were shared clearly from the start, and instalment options were available.',
      'Good value for money. The pricing was fair and clearly explained before admission.',
    ],
  },
  {
    name: 'Study Material & Support',
    reviews: [
      'The study material was well organised and easy to understand. I received timely updates about exams and admit cards.',
      'Helpful notes and study material, with every exam update shared on time.',
      'Great support right up to the exams. Admit cards, date sheets and results were all shared promptly.',
      'The online classes and study material helped me prepare well. The support team is always available.',
      'I received complete guidance before my exams, and the team stayed in touch until my results came out.',
      'Regular updates about exams and results. Everything is very well organised.',
    ],
  },
  {
    name: 'Overall Experience',
    reviews: [
      'A wonderful experience overall. I would recommend them to anyone looking to complete their studies.',
      'Highly recommended for anyone who wants to continue their education. Reliable and supportive.',
      'A trustworthy and genuine institute. I’m happy with the service from start to finish.',
      'Excellent service and support. Thank you to the whole team for helping me continue my education.',
      'I have already referred my friends here. Everything is done on time and the right way.',
      'Reliable, honest and helpful. One of the best options for distance learning and open schooling.',
      'Very satisfied with everything: the admission, the support and the results.',
    ],
  },
]

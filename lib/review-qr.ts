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
      'Admission process was very smooth and quick. The team guided me at every step and all my documents were handled properly.',
      'Mera admission bina kisi tension ke ho gaya. Staff ne har step clearly samjhaya aur time pe sab complete kiya.',
      'Got my admission done in just a few days. Everything was transparent and they kept me updated throughout.',
      'Very easy admission. I did not have to run around anywhere, the team took care of the whole process.',
      'Admission ke liye bahut jagah pucha tha, yahan sabse simple aur sahi process mila. Highly recommended!',
      'Quick, honest and hassle-free admission. They explained the eligibility and documents clearly before starting.',
      'From form filling to confirmation, everything was handled professionally. Great experience.',
      'Admission ka poora kaam ghar baithe ho gaya. Team bahut cooperative hai.',
    ],
  },
  {
    name: 'Counselling & Guidance',
    reviews: [
      'The counsellor understood my situation and suggested the right course for me. Very helpful guidance.',
      'Counselling bahut achhi thi. Mujhe sahi board aur course choose karne mein poori help mili.',
      'They gave honest advice instead of just pushing a course. I really appreciate the genuine guidance.',
      'Clear and patient counselling. All my doubts about the course, exams and validity were answered.',
      'Mere jaise working student ke liye best option bataya. Counsellor ne bahut dhyan se baat suni.',
      'Excellent guidance for my career. The counsellor explained every option with pros and cons.',
      'Bahut supportive counselling team. Kabhi bhi call karo, proper jawab milta hai.',
    ],
  },
  {
    name: 'Staff Behaviour',
    reviews: [
      'Very polite and friendly staff. They always respond quickly and treat students with respect.',
      'Staff ka behaviour bahut achha hai. Har baar call ya WhatsApp pe turant reply milta hai.',
      'Supportive team that actually cares about students. Never felt ignored.',
      'Everyone at the office was helpful and patient with my questions. Great team!',
      'Bahut hi friendly aur professional staff. Pehli baar mein hi trust ho gaya.',
      'Prompt support and a very respectful team. Thank you for all the help.',
      'The staff explained everything calmly and followed up on their own. Very professional.',
    ],
  },
  {
    name: 'Fees & Transparency',
    reviews: [
      'Fees were reasonable and everything was explained upfront. No hidden charges at all.',
      'Fee structure bilkul clear tha, koi hidden charge nahi. Har payment ki receipt mili.',
      'Affordable fees and flexible payment options. Very transparent about every charge.',
      'Proper receipts for every payment and no surprises later. Honest institute.',
      'Fees ke baare mein shuru se hi sab clear bataya gaya. Installment ka option bhi mila.',
      'Good value for money. The pricing was fair and clearly explained before admission.',
    ],
  },
  {
    name: 'Study Material & Support',
    reviews: [
      'Study material was good and easy to understand. Got timely updates about exams and admit cards.',
      'Notes aur study material bahut helpful the. Exam ki har update time pe mili.',
      'Great support till the exams. They shared admit card, date sheet and results on time.',
      'The online classes and material helped me prepare well. Support team is always available.',
      'Exam se pehle poori guidance mili. Result tak team ne saath diya.',
      'Regular updates on WhatsApp about exams and results. Very well organised.',
    ],
  },
  {
    name: 'Overall Experience',
    reviews: [
      'Overall a wonderful experience. I would recommend them to anyone looking to complete their studies.',
      'Bahut achha experience raha. Jo bhi apni padhai complete karna chahta hai, unke liye best jagah hai.',
      'Trustworthy and genuine institute. Happy with the service from start to end.',
      'Excellent service and support. Thank you to the whole team for helping me continue my education.',
      'Maine apne doston ko bhi yahan refer kiya hai. Sab kuch time pe aur sahi tarike se hota hai.',
      'Reliable, honest and helpful. One of the best places for distance and open schooling.',
      'Very satisfied with everything — admission, support and results. Five stars!',
    ],
  },
]

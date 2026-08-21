import type { Metadata } from 'next'
import WalkInForm from '@/components/public/WalkInForm'

export const metadata: Metadata = {
  title: 'Walk-In Registration — Distance Courses Wala',
  description: 'Register as a walk-in student at Distance Courses Wala',
  robots: { index: false, follow: false },
}

export default function WalkInPage() {
  return <WalkInForm />
}

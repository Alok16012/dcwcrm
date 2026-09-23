import type { Metadata } from 'next'
import AssociateJoinForm from '@/components/public/AssociateJoinForm'

export const metadata: Metadata = {
  title: 'Become an Associate — Distance Courses Wala',
  description: 'Apply to become an Associate Partner of Distance Courses Wala',
  robots: { index: false, follow: false },
}

export default function JoinPage() {
  return <AssociateJoinForm />
}

'use client'
import dynamic from 'next/dynamic'

const AssociatesClient = dynamic(() => import('./client'), { ssr: false })

export default function AssociatesPage() {
  return <AssociatesClient />
}

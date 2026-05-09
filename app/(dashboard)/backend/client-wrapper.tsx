'use client'
import dynamic from 'next/dynamic'

const BackendListClient = dynamic(
  () => import('./client').then(m => ({ default: m.BackendListClient })),
  { ssr: false }
)

export default function BackendClientWrapper() {
  return <BackendListClient />
}

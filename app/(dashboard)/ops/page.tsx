import dynamic from 'next/dynamic'

const OpsClient = dynamic(() => import('./client'), { ssr: false })

export default function OpsPage() {
  return <OpsClient />
}

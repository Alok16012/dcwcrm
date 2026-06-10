import AssociateDetailClient from './client'

export default async function AssociateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AssociateDetailClient id={id} />
}

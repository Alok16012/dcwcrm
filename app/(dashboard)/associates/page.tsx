import { AssociateManager } from '@/app/(dashboard)/admin/tabs/AssociateManager'
import { PageHeader } from '@/components/shared/PageHeader'

export default function AssociatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Associates"
        description="Register new associates and view existing applications"
      />
      <AssociateManager />
    </div>
  )
}

import { StudentPortalManager } from '@/app/(dashboard)/admin/tabs/StudentPortalManager'

export default function StudentPortalPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Portal</h1>
        <p className="text-sm text-gray-500 mt-1">Manage student portal credentials, status updates, and notifications</p>
      </div>
      <StudentPortalManager />
    </div>
  )
}

import { Badge } from '@/components/ui/badge'
import type { AppointmentStatus } from '@/types/app.types'

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-amber-100 text-amber-800',
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge className={`${STATUS_COLORS[status]} border-0`}>{STATUS_LABELS[status]}</Badge>
}

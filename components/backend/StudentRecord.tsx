import { type Student } from '@/types/app.types'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

interface StudentRecordProps {
  student: Student
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  dropped: 'bg-red-100 text-red-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
}

export function StudentRecord({ student }: StudentRecordProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><p className="text-gray-500">Full Name</p><p className="font-medium">{student.full_name}</p></div>
        <div><p className="text-gray-500">Enrollment Number</p><p className="font-medium font-mono">{student.enrollment_number}</p></div>
        <div><p className="text-gray-500">Phone</p><p className="font-medium">{student.phone}</p></div>
        <div><p className="text-gray-500">Email</p><p className="font-medium">{student.email ?? '-'}</p></div>
        <div><p className="text-gray-500">City</p><p className="font-medium">{student.city ?? '-'}</p></div>
        <div><p className="text-gray-500">Course</p><p className="font-medium">{student.course?.name ?? '-'}</p></div>
        <div><p className="text-gray-500">Sub-course</p><p className="font-medium">{student.sub_course?.name ?? '-'}</p></div>
        <div><p className="text-gray-500">Counsellor</p><p className="font-medium">{student.counsellor?.full_name ?? '-'}</p></div>
        <div>
          <p className="text-gray-500">Enrollment Date</p>
          <p className="font-medium">{student.enrollment_date ? format(new Date(student.enrollment_date), 'dd MMM yyyy') : '-'}</p>
        </div>
        <div>
          <p className="text-gray-500">Status</p>
          <Badge className={`${STATUS_COLORS[student.status] ?? 'bg-gray-100 text-gray-800'} border-0`}>
            {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
          </Badge>
        </div>
      </div>

      {student.lead_id && (
        <div className="pt-2 border-t">
          <Link href={`/leads/${student.lead_id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> View Original Lead Record
          </Link>
        </div>
      )}
    </div>
  )
}

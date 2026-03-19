'use client'
import { format } from 'date-fns'
import {
  UserPlus, ArrowRightLeft, MessageSquare, Bell,
  CreditCard, CheckCircle, FileText, Phone, Tag, Edit
} from 'lucide-react'
import type { LeadActivity, ActivityType } from '@/types/app.types'

const ACTIVITY_ICONS: Record<ActivityType, React.ElementType> = {
  created: UserPlus,
  status_changed: ArrowRightLeft,
  assigned: Tag,
  transferred: ArrowRightLeft,
  note_added: MessageSquare,
  followup_set: Bell,
  payment_received: CreditCard,
  converted: CheckCircle,
  document_uploaded: FileText,
  call_made: Phone,
  updated: Edit,
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  created: 'bg-blue-100 text-blue-600',
  status_changed: 'bg-orange-100 text-orange-600',
  assigned: 'bg-purple-100 text-purple-600',
  transferred: 'bg-indigo-100 text-indigo-600',
  note_added: 'bg-gray-100 text-gray-600',
  followup_set: 'bg-yellow-100 text-yellow-600',
  payment_received: 'bg-green-100 text-green-600',
  converted: 'bg-green-100 text-green-600',
  document_uploaded: 'bg-cyan-100 text-cyan-600',
  call_made: 'bg-pink-100 text-pink-600',
  updated: 'bg-blue-100 text-blue-600',
}

function getActivityText(activity: LeadActivity): string {
  switch (activity.activity_type) {
    case 'created': return `Lead created with status "${activity.new_value}"`
    case 'status_changed': return `Status changed from "${activity.old_value}" \u2192 "${activity.new_value}"`
    case 'assigned': return `Assigned from "${activity.old_value ?? 'Unassigned'}" to "${activity.new_value}"`
    case 'transferred': return `Transferred to "${activity.new_value}"`
    case 'note_added': return activity.note ?? 'Note added'
    case 'followup_set': return `Follow-up scheduled for ${activity.new_value}`
    case 'payment_received': return `Payment of \u20b9${activity.new_value} received`
    case 'converted': return 'Lead converted to student'
    case 'document_uploaded': return `Document uploaded: ${activity.new_value}`
    case 'call_made': return activity.note ?? 'Call logged'
    case 'updated': return `Lead details updated: ${activity.note}`
    default: return 'Activity recorded'
  }
}

interface LeadTimelineProps {
  activities: LeadActivity[]
}

export function LeadTimeline({ activities }: LeadTimelineProps) {
  if (!activities.length) {
    return <p className="text-sm text-gray-500 text-center py-8">No activity recorded yet</p>
  }

  return (
    <div className="space-y-0">
      {activities.map((activity, idx) => {
        const Icon = ACTIVITY_ICONS[activity.activity_type] ?? Tag
        const colorClass = ACTIVITY_COLORS[activity.activity_type] ?? 'bg-gray-100 text-gray-600'
        return (
          <div key={activity.id} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              {idx < activities.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
            </div>
            {/* Content */}
            <div className="pb-4 flex-1 min-w-0">
              <p className="text-sm text-gray-800">{getActivityText(activity)}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {activity.performer && (
                  <span className="text-xs text-gray-500">{activity.performer.full_name}</span>
                )}
                <span className="text-xs text-gray-400">
                  {format(new Date(activity.created_at), 'dd MMM yyyy, hh:mm a')}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Building2, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppointmentStatusBadge } from '@/components/appointments/AppointmentStatusBadge'
import { AppointmentManageDialog } from '@/components/appointments/AppointmentManageDialog'
import { HOST_ROLES } from '@/lib/appointments/constants'
import type { Appointment, Profile } from '@/types/app.types'

interface LeadAppointmentsProps {
  appointments: Appointment[]
}

// So opening a lead answers "has someone already booked a visit with this
// student" without having to go check the Appointments page separately —
// that's the whole point of keeping the history attached to the lead.
export function LeadAppointments({ appointments: initial }: LeadAppointmentsProps) {
  const supabase = createClient()
  const [appointments, setAppointments] = useState(initial)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hosts, setHosts] = useState<Profile[]>([])
  const [managing, setManaging] = useState<Appointment | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => setIsAdmin((data as any)?.role === 'admin'))
    })
    supabase.from('profiles').select('id, full_name, role')
      .in('role', HOST_ROLES as unknown as string[]).eq('is_active', true).order('full_name')
      .then(({ data }) => setHosts((data ?? []) as Profile[]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!appointments.length) {
    return <p className="text-sm text-gray-500 text-center py-6">No appointments scheduled yet</p>
  }

  return (
    <div className="space-y-2">
      {appointments.map((a) => {
        const canManage = !!currentUserId && (isAdmin || a.host_id === currentUserId || a.created_by === currentUserId)
        return (
          <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                {a.appointment_type === 'google_meet' ? <Video className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {format(parseISO(a.scheduled_date), 'dd MMM yyyy')} · {a.scheduled_time.slice(0, 5)}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {a.host?.full_name ?? 'Host'} · booked by {a.creator?.full_name ?? '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <AppointmentStatusBadge status={a.status} />
              {canManage && (
                <button onClick={() => setManaging(a)} className="text-xs font-semibold text-blue-600 hover:underline">
                  Manage
                </button>
              )}
            </div>
          </div>
        )
      })}

      {managing && currentUserId && (
        <AppointmentManageDialog
          appointment={managing}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          hosts={hosts}
          open={!!managing}
          onClose={() => setManaging(null)}
          onUpdated={(updated) => {
            setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
          }}
        />
      )}
    </div>
  )
}

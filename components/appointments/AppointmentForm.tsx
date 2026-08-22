'use client'
import { useEffect, useState } from 'react'
import { Building2, Video } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SlotPicker } from './SlotPicker'
import { LeadPicker } from './LeadPicker'
import { HOST_ROLES } from '@/lib/appointments/constants'
import { appointmentSchema } from '@/lib/validations/appointment.schema'
import type { Appointment, AppointmentType, Profile } from '@/types/app.types'
import { cn } from '@/lib/utils'

interface LeadOption { id: string; full_name: string; phone: string }

interface AppointmentFormProps {
  /** Set when opened from a lead's own page — the lead field is fixed. */
  lockedLead?: LeadOption
  onSuccess: (appointment: Appointment) => void
  onCancel: () => void
}

export function AppointmentForm({ lockedLead, onSuccess, onCancel }: AppointmentFormProps) {
  const supabase = createClient()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [hosts, setHosts] = useState<Profile[]>([])

  const [appointmentType, setAppointmentType] = useState<AppointmentType>('office_visit')
  const [hostId, setHostId] = useState<string | undefined>(undefined)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [meetLink, setMeetLink] = useState('')
  const [notes, setNotes] = useState('')
  const [lead, setLead] = useState<LeadOption | null>(lockedLead ?? null)
  const [slotRefreshKey, setSlotRefreshKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id)
        setHostId((prev) => prev || user.id)
      }
    })
    supabase.from('profiles').select('id, full_name, role')
      .in('role', HOST_ROLES as unknown as string[])
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setHosts((data ?? []) as Profile[]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    if (!lead) { toast.error('Select a lead'); return }

    const parsed = appointmentSchema.safeParse({
      lead_id: lead.id,
      appointment_type: appointmentType,
      host_id: hostId,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      meet_link: meetLink,
      notes,
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Check the form and try again')
      return
    }
    if (!currentUserId) { toast.error('Not signed in'); return }

    setSubmitting(true)
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        lead_id: lead.id,
        appointment_type: appointmentType,
        meet_link: appointmentType === 'google_meet' ? meetLink.trim() : null,
        host_id: hostId,
        created_by: currentUserId,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        notes: notes.trim() || null,
      } as never)
      .select('*, lead:leads(id, full_name, phone), host:profiles!appointments_host_id_fkey(id, full_name), creator:profiles!appointments_created_by_fkey(id, full_name)')
      .single()
    setSubmitting(false)

    if (error) {
      if (error.code === '23505') {
        toast.error('That slot was just booked by someone else — pick another')
        setScheduledTime('')
        setSlotRefreshKey((k) => k + 1)
      } else {
        toast.error(error.message || 'Could not create appointment')
      }
      return
    }

    const appointment = data as unknown as Appointment
    const hostName = hosts.find((h) => h.id === hostId)?.full_name ?? 'host'

    // Both best-effort: the appointment itself is already saved, neither of
    // these should block or roll back a successful booking.
    supabase.from('lead_activities').insert({
      lead_id: lead.id,
      activity_type: 'appointment_scheduled',
      new_value: `${appointmentType === 'google_meet' ? 'Google Meet' : 'Office Visit'} · ${scheduledDate} ${scheduledTime} · ${hostName}`,
      performed_by: currentUserId,
    } as never).then(() => {})

    if (hostId !== currentUserId) {
      supabase.from('notifications').insert({
        title: 'New appointment scheduled',
        message: `${lead.full_name} · ${scheduledDate} ${scheduledTime}`,
        type: 'info',
        target_user_id: hostId,
      } as never).then(() => {})
    }

    toast.success('Appointment scheduled')
    onSuccess(appointment)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 block">Lead</Label>
        <LeadPicker value={lead} onChange={setLead} />
      </div>

      <div>
        <Label className="mb-1.5 block">Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['office_visit', 'google_meet'] as AppointmentType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setAppointmentType(t)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                appointmentType === t
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              {t === 'office_visit' ? <Building2 className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              {t === 'office_visit' ? 'Office Visit' : 'Google Meet'}
            </button>
          ))}
        </div>
      </div>

      {appointmentType === 'google_meet' && (
        <div>
          <Label className="mb-1.5 block">Google Meet link</Label>
          <Input value={meetLink} onChange={(e) => setMeetLink(e.target.value)} placeholder="https://meet.google.com/xxx-xxxx-xxx" />
        </div>
      )}

      <div>
        <Label className="mb-1.5 block">Host (Counselor who will conduct the visit)</Label>
        <Select value={hostId ?? ''} onValueChange={(v) => { setHostId(v || undefined); setScheduledTime('') }}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Who will host?">
              {(hostId && hosts.find((h) => h.id === hostId)?.full_name) ?? 'Who will host?'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {hosts.map((h) => (
              <SelectItem key={h.id} value={h.id}>{h.full_name}{h.id === currentUserId ? ' (you)' : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-1.5 block">Date</Label>
        <Input
          type="date"
          value={scheduledDate}
          onChange={(e) => { setScheduledDate(e.target.value); setScheduledTime('') }}
          min={new Date().toISOString().slice(0, 10)}
        />
      </div>

      <div>
        <Label className="mb-1.5 block">Slot</Label>
        <SlotPicker
          hostId={hostId ?? null}
          date={scheduledDate}
          value={scheduledTime}
          onChange={setScheduledTime}
          refreshKey={slotRefreshKey}
        />
      </div>

      <div>
        <Label className="mb-1.5 block">Notes (optional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Purpose of the visit…" className="min-h-16" />
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={submitting} className="w-full sm:w-auto h-11 text-base">Cancel</Button>
        <Button onClick={handleSubmit} disabled={submitting || !scheduledTime} className="w-full sm:w-auto h-11 text-base">
          {submitting ? 'Scheduling…' : 'Schedule Appointment'}
        </Button>
      </div>
    </div>
  )
}

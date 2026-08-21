'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SlotPicker } from './SlotPicker'
import { format, parseISO } from 'date-fns'
import { MessageCircle } from 'lucide-react'
import type { Appointment, AppointmentStatus, Profile } from '@/types/app.types'

function normalizePhone(raw?: string): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 10) digits = '91' + digits
  else if (digits.length === 12 && digits.startsWith('91')) { /* already ok */ }
  else if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1)
  return digits.length >= 11 ? digits : null
}

function waMessage(appointment: Appointment): string {
  const date = format(parseISO(appointment.scheduled_date), 'dd MMM yyyy')
  const time = appointment.scheduled_time.slice(0, 5)
  const typeLabel = appointment.appointment_type === 'google_meet' ? 'Google Meet' : 'Office Visit'
  const hostName = appointment.host?.full_name ?? 'our counselor'
  const lines = [
    `Hello ${appointment.lead?.full_name ?? ''},`,
    '',
    `Your ${typeLabel} appointment has been scheduled at DCW.`,
    `📅 Date: ${date}`,
    `⏰ Time: ${time}`,
    `👤 Host: ${hostName}`,
  ]
  if (appointment.appointment_type === 'google_meet' && appointment.meet_link) {
    lines.push(`🔗 Link: ${appointment.meet_link}`)
  }
  lines.push('', '- Team Distance Courses Wala')
  return lines.join('\n')
}

interface AppointmentManageDialogProps {
  appointment: Appointment
  currentUserId: string
  isAdmin: boolean
  hosts: Profile[]
  open: boolean
  onClose: () => void
  onUpdated: (appointment: Appointment) => void
}

const STATUS_OPTIONS: AppointmentStatus[] = ['scheduled', 'completed', 'cancelled', 'no_show']

// Reuses the same activity vocabulary lead_activities already has rather
// than adding a fourth appointment_* type just for no_show.
function activityForStatus(status: AppointmentStatus): { activity_type: string; new_value: string } {
  if (status === 'completed') return { activity_type: 'appointment_completed', new_value: 'Completed' }
  if (status === 'cancelled') return { activity_type: 'appointment_cancelled', new_value: 'Cancelled' }
  return { activity_type: 'status_changed', new_value: 'No Show' }
}

export function AppointmentManageDialog({ appointment, currentUserId, isAdmin, hosts, open, onClose, onUpdated }: AppointmentManageDialogProps) {
  const supabase = createClient()
  const canManage = isAdmin || appointment.host_id === currentUserId || appointment.created_by === currentUserId

  const [status, setStatus] = useState<AppointmentStatus>(appointment.status)
  const [reviewNote, setReviewNote] = useState(appointment.review_note ?? '')
  const [hostId, setHostId] = useState(appointment.host_id)
  const [scheduledDate, setScheduledDate] = useState(appointment.scheduled_date)
  const [scheduledTime, setScheduledTime] = useState(appointment.scheduled_time.slice(0, 5))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const update: Record<string, unknown> = { status }
    if (isAdmin) {
      update.review_note = reviewNote.trim() || null
      update.host_id = hostId
      update.scheduled_date = scheduledDate
      update.scheduled_time = scheduledTime
    }

    const { data, error } = await supabase
      .from('appointments')
      .update(update as never)
      .eq('id', appointment.id)
      .select('*, lead:leads(id, full_name, phone), host:profiles!appointments_host_id_fkey(id, full_name), creator:profiles!appointments_created_by_fkey(id, full_name)')
      .single()
    setSaving(false)

    if (error) {
      if (error.code === '23505') toast.error('That slot is already booked for this host')
      else toast.error(error.message || 'Could not update appointment')
      return
    }

    if (status !== appointment.status) {
      const { activity_type, new_value } = activityForStatus(status)
      supabase.from('lead_activities').insert({
        lead_id: appointment.lead_id,
        activity_type,
        old_value: appointment.status,
        new_value,
        performed_by: currentUserId,
      } as never).then(() => {})
    }

    toast.success('Appointment updated')
    onUpdated(data as unknown as Appointment)
    onClose()
  }

  function handleWhatsApp() {
    const phone = normalizePhone(appointment.lead?.phone)
    if (!phone) {
      toast.error('No valid phone number for this lead')
      return
    }
    const msg = waMessage(appointment)
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Manage Appointment</DialogTitle></DialogHeader>

        {!canManage ? (
          <p className="text-sm text-gray-500">Only the host, the person who booked it, or an admin can manage this appointment.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
              <p className="text-sm font-medium text-gray-900">{appointment.lead?.full_name}</p>
              <p className="text-xs text-gray-500">{appointment.lead?.phone}</p>
            </div>

            <div>
              <Label className="mb-1.5 block">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus((v || 'scheduled') as AppointmentStatus)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s === 'no_show' ? 'No Show' : s[0].toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAdmin ? (
              <>
                <div>
                  <Label className="mb-1.5 block">Host</Label>
                  <Select value={hostId} onValueChange={(v) => { setHostId(v || hostId); setScheduledTime('') }}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {hosts.map((h) => <SelectItem key={h.id} value={h.id}>{h.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Date</Label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => { setScheduledDate(e.target.value); setScheduledTime('') }}
                    className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Slot</Label>
                  <SlotPicker hostId={hostId} date={scheduledDate} value={scheduledTime} onChange={setScheduledTime} excludeId={appointment.id} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Review note</Label>
                  <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Outcome of the visit…" className="min-h-20" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="mb-1.5 block text-gray-500">Host</Label>
                  <p className="text-sm text-gray-700">{hosts.find((h) => h.id === appointment.host_id)?.full_name ?? '—'}</p>
                </div>
                <div>
                  <Label className="mb-1.5 block text-gray-500">Scheduled for</Label>
                  <p className="text-sm text-gray-700">{appointment.scheduled_date} · {appointment.scheduled_time.slice(0, 5)}</p>
                </div>
                {appointment.review_note && (
                  <div>
                    <Label className="mb-1.5 block text-gray-500">Review note</Label>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{appointment.review_note}</p>
                  </div>
                )}
              </>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={handleWhatsApp} className="text-green-700 hover:bg-green-50 gap-1.5">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </Button>
              <Button variant="outline" onClick={onClose} disabled={saving}>Close</Button>
              <Button onClick={handleSave} disabled={saving || (isAdmin && !scheduledTime)}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'
import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Plus, Search, Building2, Video, MessageCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AppointmentForm } from '@/components/appointments/AppointmentForm'
import { AppointmentManageDialog } from '@/components/appointments/AppointmentManageDialog'
import { AppointmentStatusBadge } from '@/components/appointments/AppointmentStatusBadge'
import { SlotPicker } from '@/components/appointments/SlotPicker'
import { toast } from 'sonner'
import type { Appointment, AppointmentStatus, Profile } from '@/types/app.types'

interface AppointmentsClientProps {
  currentUserId: string
  role: string
  hosts: Profile[]
  initialAppointments: Appointment[]
}

export default function AppointmentsClient({ currentUserId, role, hosts, initialAppointments }: AppointmentsClientProps) {
  const isAdmin = role === 'admin'
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments)
  const [showForm, setShowForm] = useState(false)
  const [managing, setManaging] = useState<Appointment | null>(null)

  function normalizePhone(raw?: string): string | null {
    if (!raw) return null
    let digits = raw.replace(/\D/g, '')
    if (digits.length === 10) digits = '91' + digits
    else if (digits.length === 12 && digits.startsWith('91')) { /* already ok */ }
    else if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1)
    return digits.length >= 11 ? digits : null
  }

  function handleWhatsApp(appointment: Appointment) {
    const phone = normalizePhone(appointment.lead?.phone)
    if (!phone) { toast.error('No valid phone number'); return }
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
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Slot browser
  const [browseHostId, setBrowseHostId] = useState(currentUserId)
  const [browseDate, setBrowseDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // History filters
  const [search, setSearch] = useState('')
  const [hostFilter, setHostFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all')

  const filtered = useMemo(() => appointments.filter((a) => {
    if (hostFilter !== 'all' && a.host_id !== hostFilter) return false
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (search && !a.lead?.full_name?.toLowerCase().includes(search.toLowerCase()) && !a.lead?.phone?.includes(search)) return false
    return true
  }), [appointments, hostFilter, statusFilter, search])

  function handleCreated(appointment: Appointment) {
    setAppointments((prev) => [appointment, ...prev])
    setShowForm(false)
  }

  function handleUpdated(appointment: Appointment) {
    setAppointments((prev) => prev.map((a) => (a.id === appointment.id ? appointment : a)))
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Appointments"
        description="Schedule and track office visits & Google Meet appointments"
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Appointment
          </Button>
        }
      />

      <Tabs defaultValue="browser" className="w-full">
        <TabsList>
          <TabsTrigger value="browser">Slot Browser</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="browser" className="mt-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
            <div className="flex flex-wrap gap-3">
              <Select value={browseHostId} onValueChange={(v) => setBrowseHostId(v || currentUserId)}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Select host">
                    {hosts.find((h) => h.id === browseHostId)?.full_name ?? 'Select host'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {hosts.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.full_name}{h.id === currentUserId ? ' (you)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={browseDate} onChange={(e) => setBrowseDate(e.target.value)} className="w-full sm:w-48" />
            </div>
            <SlotPicker hostId={browseHostId} date={browseDate} readOnly />
            <p className="text-xs text-gray-400">Grayed-out, struck-through slots are already booked.</p>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-4 py-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lead name or phone" className="pl-9" />
              </div>
              <Select value={hostFilter} onValueChange={(v) => setHostFilter(v || 'all')}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All Hosts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Hosts</SelectItem>
                  {hosts.map((h) => <SelectItem key={h.id} value={h.id}>{h.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v || 'all') as AppointmentStatus | 'all')}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filtered.length === 0 ? (
              <div className="py-14 text-center text-sm text-gray-400">No appointments found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Host</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Booked by</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => {
                      const canManage = isAdmin || a.host_id === currentUserId || a.created_by === currentUserId
                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <p className="font-medium text-gray-900">{a.lead?.full_name ?? '—'}</p>
                            <p className="text-xs text-gray-500">{a.lead?.phone}</p>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
                              {a.appointment_type === 'google_meet' ? <Video className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                              {a.appointment_type === 'google_meet' ? 'Google Meet' : 'Office Visit'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{a.host?.full_name ?? '—'}</TableCell>
                          <TableCell className="text-sm">
                            {format(parseISO(a.scheduled_date), 'dd MMM yyyy')} · {a.scheduled_time.slice(0, 5)}
                          </TableCell>
                          <TableCell><AppointmentStatusBadge status={a.status} /></TableCell>
                          <TableCell className="text-sm text-gray-500">{a.creator?.full_name ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Send via WhatsApp"
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleWhatsApp(a)}
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" disabled={!canManage} onClick={() => setManaging(a)}>
                                Manage
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) setShowForm(false) }}>
        <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Schedule Appointment</DialogTitle></DialogHeader>
          <AppointmentForm onSuccess={handleCreated} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      {managing && (
        <AppointmentManageDialog
          appointment={managing}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          hosts={hosts}
          open={!!managing}
          onClose={() => setManaging(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}

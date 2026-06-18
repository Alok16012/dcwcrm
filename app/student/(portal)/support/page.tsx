'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HelpCircle, Send, Bell, ChevronDown, ChevronUp, Package, MessageSquare, Phone, AlertCircle, CheckCircle2, Clock, Paperclip, PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface Ticket { id: string; subject: string; message: string; status: string; priority: string; admin_reply: string | null; created_at: string }
interface Notification { id: string; title: string; message: string; type: string; is_read: boolean; created_at: string; file_url?: string | null; category?: string | null }
interface Announcement { id: string; title: string; body: string; type: string; created_at: string }
interface FAQ { id: string; question: string; answer: string; category: string }
interface Dispatch { id: string; document_type: string; courier: string | null; tracking_number: string | null; status: string; dispatch_date: string | null; expected_delivery: string | null }
interface Mentor { full_name: string; phone: string | null }

const notifTypeColor: Record<string, string> = {
  info: 'border-blue-200 bg-blue-50',
  success: 'border-green-200 bg-green-50',
  warning: 'border-yellow-200 bg-yellow-50',
  alert: 'border-red-200 bg-red-50',
}

const ticketStatusColor: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
}

export default function SupportPage() {
  const supabase = createClient()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [enrollmentNumber, setEnrollmentNumber] = useState<string>('')
  const [mentor, setMentor] = useState<Mentor | null>(null)
  const [tab, setTab] = useState<'notifications' | 'tickets' | 'dispatch' | 'faqs' | 'announcements'>('notifications')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '', priority: 'normal' })
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: s } = await (supabase as any)
      .from('students')
      .select('id, enrollment_number, mentor_telecaller_id')
      .eq('portal_user_id', user.id)
      .single() as { data: { id: string; enrollment_number: string; mentor_telecaller_id: string | null } | null }
    if (!s) return
    setStudentId(s.id)
    setEnrollmentNumber(s.enrollment_number)
    const db = supabase as any

    // Load mentor if assigned
    if (s.mentor_telecaller_id) {
      const { data: m } = await db.from('profiles').select('full_name, phone').eq('id', s.mentor_telecaller_id).single()
      if (m) setMentor(m as Mentor)
    }

    const [notif, annc, tick, faq, disp] = await Promise.all([
      db.from('student_notifications').select('*').eq('student_id', s.id).order('created_at', { ascending: false }).limit(20),
      db.from('student_announcements').select('id, title, body, type, created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(10),
      db.from('student_support_tickets').select('id, subject, message, status, priority, admin_reply, created_at').eq('student_id', s.id).order('created_at', { ascending: false }),
      db.from('student_faqs').select('id, question, answer, category').eq('is_active', true).order('sort_order'),
      db.from('student_dispatches').select('id, document_type, courier, tracking_number, status, dispatch_date, expected_delivery').eq('enrollment_number', s.enrollment_number).order('created_at', { ascending: false }),
    ])
    setNotifications((notif.data ?? []) as Notification[])
    setAnnouncements((annc.data ?? []) as Announcement[])
    setTickets((tick.data ?? []) as Ticket[])
    setFaqs((faq.data ?? []) as FAQ[])
    setDispatches((disp.data ?? []) as Dispatch[])
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function markAllRead() {
    if (!studentId) return
    await (supabase as any).from('student_notifications').update({ is_read: true }).eq('student_id', studentId).eq('is_read', false)
    setNotifications(n => n.map(x => ({ ...x, is_read: true })))
    toast.success('All marked as read')
  }

  async function submitTicket() {
    if (!studentId || !ticketForm.subject || !ticketForm.message) {
      toast.error('Subject and message are required')
      return
    }
    setSubmitting(true)
    const { error } = await (supabase as any).from('student_support_tickets').insert({
      student_id: studentId,
      subject: ticketForm.subject,
      message: ticketForm.message,
      priority: ticketForm.priority,
    })
    setSubmitting(false)
    if (error) { toast.error(error.message); return }
    toast.success('Ticket raised! We will respond within 24-48 hours.')
    setTicketForm({ subject: '', message: '', priority: 'normal' })
    load()
  }

  const dispatchStatusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    dispatched: 'bg-blue-100 text-blue-700',
    in_transit: 'bg-indigo-100 text-indigo-700',
    delivered: 'bg-green-100 text-green-700',
    returned: 'bg-red-100 text-red-700',
    failed: 'bg-red-100 text-red-700',
  }

  const TABS = [
    { key: 'notifications', label: 'Notifications', icon: Bell, badge: notifications.filter(n => !n.is_read).length },
    { key: 'announcements', label: 'Announcements', icon: AlertCircle, badge: 0 },
    { key: 'dispatch', label: 'Dispatch', icon: Package, badge: 0 },
    { key: 'tickets', label: 'My Tickets', icon: MessageSquare, badge: tickets.filter(t => t.status === 'resolved' && t.admin_reply).length },
    { key: 'faqs', label: 'FAQs', icon: HelpCircle, badge: 0 },
  ] as const

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Help & Support</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track dispatches, raise tickets, view FAQs and announcements</p>
      </div>

      {/* Contact cards */}
      <div className="space-y-3">
        {/* WhatsApp support */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shrink-0">
            <Phone className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-900">Help & Support</p>
            <p className="text-xs text-green-700 font-mono">+91 99395 87009</p>
            <p className="text-xs text-green-600 mt-0.5">Mon–Sat, 9am–6pm</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <a href="tel:+919939587009"
              className="flex items-center gap-1 bg-white border border-green-300 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-green-50 transition-colors">
              <PhoneCall className="h-3.5 w-3.5" /> Call
            </a>
            <a href="https://wa.me/919939587009" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors">
              <Phone className="h-3.5 w-3.5" /> WhatsApp
            </a>
          </div>
        </div>

        {/* Mentor contact */}
        {mentor && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm">
              {mentor.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-0.5">Your Mentor</p>
              <p className="text-sm font-bold text-blue-900">{mentor.full_name}</p>
              {mentor.phone && <p className="text-xs text-blue-600 font-mono">{mentor.phone}</p>}
            </div>
            {mentor.phone && (
              <div className="flex gap-2 shrink-0">
                <a href={`tel:${mentor.phone}`}
                  className="flex items-center gap-1 bg-white border border-blue-300 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-colors">
                  <PhoneCall className="h-3.5 w-3.5" /> Call
                </a>
                <a href={`https://wa.me/91${mentor.phone.replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors">
                  <Phone className="h-3.5 w-3.5" /> WhatsApp
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all relative ${tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {badge > 0 && (
              <span className="ml-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">{notifications.filter(n => !n.is_read).length} unread</p>
            {notifications.some(n => !n.is_read) && (
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={markAllRead}>Mark all read</Button>
            )}
          </div>
          {!notifications.length ? (
            <div className="bg-white rounded-2xl border p-10 text-center text-gray-400">No notifications yet</div>
          ) : notifications.map(n => (
            <div key={n.id} className={`border rounded-2xl p-4 ${notifTypeColor[n.type] ?? 'bg-gray-50 border-gray-100'} ${!n.is_read ? 'ring-1 ring-blue-200' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold ${!n.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                    {n.category && (
                      <span className="text-[10px] px-2 py-0.5 bg-white/70 border border-gray-200 rounded-full text-gray-500 font-medium">{n.category}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{n.message}</p>
                  {n.file_url && (
                    <a
                      href={n.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-600 font-medium hover:text-blue-800 hover:underline underline-offset-2"
                    >
                      <Paperclip className="h-3 w-3" />
                      View attachment
                    </a>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  {!n.is_read && <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Announcements tab */}
      {tab === 'announcements' && (
        <div className="space-y-3">
          {!announcements.length ? (
            <div className="bg-white rounded-2xl border p-10 text-center text-gray-400">No announcements</div>
          ) : announcements.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full capitalize">{a.type}</span>
              </div>
              <p className="text-xs text-gray-600">{a.body}</p>
              <p className="text-xs text-gray-400 mt-2">{new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          ))}
        </div>
      )}

      {/* Dispatch tracking tab */}
      {tab === 'dispatch' && (
        <div className="space-y-3">
          {!dispatches.length ? (
            <div className="bg-white rounded-2xl border p-10 text-center text-gray-400">No dispatch records yet</div>
          ) : dispatches.map(d => (
            <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 capitalize">{d.document_type.replace('_', ' ')}</p>
                  {d.courier && <p className="text-xs text-gray-500 mt-0.5">{d.courier}{d.tracking_number && ` · ${d.tracking_number}`}</p>}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${dispatchStatusColor[d.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {d.status.replace('_', ' ')}
                </span>
              </div>
              {(d.dispatch_date || d.expected_delivery) && (
                <div className="flex gap-4 text-xs text-gray-500">
                  {d.dispatch_date && <span>Dispatched: {new Date(d.dispatch_date).toLocaleDateString('en-IN')}</span>}
                  {d.expected_delivery && <span>Expected: {new Date(d.expected_delivery).toLocaleDateString('en-IN')}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* My tickets tab */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          {/* Raise ticket form */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-500" /> Raise a New Ticket
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label className="text-xs font-medium text-gray-600">Subject</Label>
                  <Input className="h-9 text-sm" placeholder="Brief subject of your issue" value={ticketForm.subject} onChange={e => setTicketForm(f => ({ ...f, subject: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Priority</Label>
                  <Select value={ticketForm.priority} onValueChange={v => v && setTicketForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['low', 'normal', 'high', 'urgent'].map(p => <SelectItem key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Message</Label>
                <Textarea className="text-sm" rows={3} placeholder="Describe your issue in detail..." value={ticketForm.message} onChange={e => setTicketForm(f => ({ ...f, message: e.target.value }))} />
              </div>
              <Button onClick={submitTicket} disabled={submitting || !ticketForm.subject || !ticketForm.message} className="w-full h-9 text-sm">
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </Button>
            </div>
          </div>

          {/* Past tickets */}
          {tickets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Tickets</p>
              {tickets.map(t => (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{t.subject}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${ticketStatusColor[t.status] ?? 'bg-gray-100 text-gray-600'}`}>{t.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.message}</p>
                  {t.admin_reply && (
                    <div className="mt-3 bg-green-50 border border-green-100 rounded-xl p-3">
                      <p className="text-xs font-semibold text-green-800 flex items-center gap-1 mb-1"><CheckCircle2 className="h-3.5 w-3.5" /> Reply from Support</p>
                      <p className="text-xs text-green-700">{t.admin_reply}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAQs tab */}
      {tab === 'faqs' && (
        <div className="space-y-2">
          {!faqs.length ? (
            <div className="bg-white rounded-2xl border p-10 text-center text-gray-400">No FAQs available</div>
          ) : faqs.map(f => (
            <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setOpenFaq(openFaq === f.id ? null : f.id)}
              >
                <p className="text-sm font-medium text-gray-900 pr-4">{f.question}</p>
                {openFaq === f.id ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
              </button>
              {openFaq === f.id && (
                <div className="px-5 pb-4 border-t border-gray-50">
                  <p className="text-sm text-gray-600 pt-3">{f.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

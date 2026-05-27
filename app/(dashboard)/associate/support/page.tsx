'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  HelpCircle, Plus, CheckCircle2, Clock, MessageSquare, Phone,
  ChevronDown, ChevronUp, ExternalLink, BookOpen, AlertCircle,
} from 'lucide-react'

interface Ticket {
  id: string
  subject: string
  message: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  admin_reply: string | null
  created_at: string
  updated_at: string
}

const STATUS_CFG = {
  open:        { label: 'Open',        color: 'bg-blue-100 text-blue-800 border-blue-200' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  resolved:    { label: 'Resolved',    color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  closed:      { label: 'Closed',      color: 'bg-gray-100 text-gray-600 border-gray-200' },
}
const PRIORITY_CFG = {
  low:    { label: 'Low',    color: 'text-gray-400' },
  normal: { label: 'Normal', color: 'text-blue-500' },
  high:   { label: 'High',   color: 'text-orange-500' },
  urgent: { label: 'Urgent', color: 'text-red-500' },
}

const FAQS = [
  { q: 'How do I add a new lead?',              a: 'Go to the Leads section and click "Add New Lead". Fill in the student details and submit. Our counselors will follow up within 24 hours.' },
  { q: 'When will I receive my commission?',     a: 'Commissions are credited to your wallet once the student\'s admission is confirmed and fee payment is received. You can check your wallet balance in the Accounts section.' },
  { q: 'How do I track my student\'s dispatch?', a: 'Go to the Dispatch section to see real-time tracking for all document dispatches. You\'ll see the courier name and tracking ID once dispatched.' },
  { q: 'How do I download marketing materials?', a: 'Visit the Resources section where you\'ll find brochures, posters, fee structures, and other marketing materials available for download.' },
  { q: 'What is the Student Progress Lifecycle?',a: 'It tracks your student\'s journey from Lead Received → Documents Submitted → Admission Confirmed → Enrollment Generated → Exam Form Filled → Hall Ticket Released → Result Declared → Marksheet Dispatched.' },
  { q: 'How do I recharge my wallet?',           a: 'Go to Accounts and click "Recharge Wallet". Upload your payment receipt and submit. OPS team will approve and credit your wallet within 1-2 working days.' },
]

export default function AssociateSupportPage() {
  const supabase = createClient()
  const db = supabase as any
  const [assocId, setAssocId] = useState<string | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ subject: '', message: '', priority: 'normal' })
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: assoc } = await db.from('associates').select('id').eq('user_id', user.id).single()
    if (!assoc) { setLoading(false); return }
    setAssocId(assoc.id)
    const { data } = await db.from('associate_support_tickets')
      .select('id, subject, message, status, priority, admin_reply, created_at, updated_at')
      .eq('associate_id', assoc.id)
      .order('created_at', { ascending: false })
    setTickets((data ?? []) as Ticket[])
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  async function handleSubmitTicket() {
    if (!form.subject.trim() || !form.message.trim()) { toast.error('Subject and message are required'); return }
    if (!assocId) return
    setSubmitting(true)
    try {
      const { error } = await db.from('associate_support_tickets').insert({
        associate_id: assocId,
        subject: form.subject.trim(),
        message: form.message.trim(),
        priority: form.priority,
        status: 'open',
      })
      if (error) { toast.error(error.message); return }
      toast.success('Ticket submitted! We\'ll respond within 24 hours.')
      setDialogOpen(false)
      setForm({ subject: '', message: '', priority: 'normal' })
      load()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Help & Support</h1>
          <p className="text-sm text-gray-400 mt-0.5">Raise tickets, get help, or contact us directly</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2" size="sm">
          <Plus className="w-4 h-4" /> Raise Ticket
        </Button>
      </div>

      {/* Quick Contact */}
      <div className="grid grid-cols-2 gap-3">
        <a
          href="https://wa.me/918800000000"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-emerald-100 transition-colors group"
        >
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800">WhatsApp Support</p>
            <p className="text-xs text-emerald-600 mt-0.5">Quick help via WhatsApp</p>
          </div>
          <ExternalLink className="w-4 h-4 text-emerald-400 ml-auto group-hover:text-emerald-600" />
        </a>
        <div
          onClick={() => setDialogOpen(true)}
          className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-blue-100 transition-colors group cursor-pointer"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-blue-800">Raise a Ticket</p>
            <p className="text-xs text-blue-600 mt-0.5">Response in 24–48 hours</p>
          </div>
          <Plus className="w-4 h-4 text-blue-400 ml-auto group-hover:text-blue-600" />
        </div>
      </div>

      {/* My Tickets */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-blue-500" />
            <span className="font-semibold text-gray-900 text-sm">My Tickets</span>
            {tickets.filter(t => t.status !== 'closed').length > 0 && (
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {tickets.filter(t => t.status !== 'closed').length} active
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <HelpCircle className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">No tickets yet</p>
            <p className="text-xs text-gray-300 mt-1">Raise a ticket if you need help</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {tickets.map(t => {
              const st = STATUS_CFG[t.status] ?? STATUS_CFG.open
              const pr = PRIORITY_CFG[t.priority] ?? PRIORITY_CFG.normal
              const isExpanded = expanded === t.id
              return (
                <div key={t.id} className="overflow-hidden">
                  <button
                    className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : t.id)}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'resolved' || t.status === 'closed' ? 'bg-emerald-400' : 'bg-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.subject}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {' · '}
                        <span className={pr.color}>{pr.label}</span> priority
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${st.color}`}>{st.label}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-gray-50/50 border-t border-gray-50 space-y-3">
                      <div className="bg-white border border-gray-100 rounded-xl p-3 mt-3">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Your Message</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{t.message}</p>
                      </div>
                      {t.admin_reply && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                          <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1">Support Reply</p>
                          <p className="text-sm text-blue-900 leading-relaxed">{t.admin_reply}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* FAQs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50">
          <BookOpen className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-gray-900 text-sm">Frequently Asked Questions</span>
        </div>
        <div className="divide-y divide-gray-50">
          {FAQS.map((faq, i) => {
            const isOpen = faqOpen === i
            return (
              <div key={i} className="overflow-hidden">
                <button
                  className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setFaqOpen(isOpen ? null : i)}
                >
                  <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <p className="flex-1 text-sm font-semibold text-gray-800">{faq.q}</p>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 bg-orange-50/40">
                    <p className="text-sm text-gray-600 leading-relaxed pl-7">{faq.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Raise Ticket Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" /> Raise a Support Ticket
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <Input placeholder="Brief description of your issue" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Message *</Label>
              <textarea
                className="w-full min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
                placeholder="Describe your issue in detail…"
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              Our support team typically responds within 24–48 hours on business days.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button className="flex-1" onClick={handleSubmitTicket} disabled={submitting}>
                {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Submit Ticket'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

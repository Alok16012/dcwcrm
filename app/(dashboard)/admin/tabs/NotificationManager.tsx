'use client'
import { useState } from 'react'
import { Bell, Send, Clock, Users, User, CheckCheck, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface SentNotification {
  id: string
  title: string
  message: string
  type: 'informational' | 'action_required' | 'urgent'
  target: string
  channels: string[]
  sent_at: string
  recipients: number
}

interface Props {
  counsellors: { id: string; full_name: string; role: string }[]
}

const SAMPLE_SENT: SentNotification[] = [
  { id: '1', title: 'New Prospectus Available', message: 'Updated prospectus for XYZ College is now available. Download from Fee Structure page.', type: 'informational', target: 'All Associates', channels: ['in-app', 'whatsapp'], sent_at: '2026-04-20 10:30', recipients: 48 },
  { id: '2', title: 'Bonus Incentive — April', message: 'Premium admissions this month earn extra ₹500 bonus. Valid till 30 April 2026.', type: 'informational', target: 'All Associates', channels: ['in-app', 'whatsapp', 'sms'], sent_at: '2026-04-15 09:00', recipients: 48 },
  { id: '3', title: 'Document Submission Deadline', message: 'Reminder: All pending documents must be submitted by 25 April 2026.', type: 'action_required', target: 'Specific Counselor', channels: ['in-app', 'email'], sent_at: '2026-04-14 11:00', recipients: 12 },
]

const TYPE_COLORS: Record<SentNotification['type'], string> = {
  informational: 'bg-blue-100 text-blue-700',
  action_required: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
}

export function NotificationManager({ counsellors }: Props) {
  const [sent, setSent] = useState<SentNotification[]>(SAMPLE_SENT)
  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'informational' as SentNotification['type'],
    target: 'all_associates',
    counsellor_id: '',
    scheduled: false,
    scheduled_at: '',
    ch_inapp: true,
    ch_email: false,
    ch_sms: false,
    ch_whatsapp: false,
  })

  function handleSend() {
    if (!form.title || !form.message) { toast.error('Title and message are required'); return }
    const targetLabel = form.target === 'all_associates' ? 'All Associates' : form.target === 'counselor_associates' ? 'Specific Counselor Group' : 'Individual'
    const channels = [form.ch_inapp && 'in-app', form.ch_email && 'email', form.ch_sms && 'sms', form.ch_whatsapp && 'whatsapp'].filter(Boolean) as string[]
    const entry: SentNotification = {
      id: Date.now().toString(), title: form.title, message: form.message, type: form.type,
      target: targetLabel, channels, sent_at: form.scheduled && form.scheduled_at ? `Scheduled: ${form.scheduled_at}` : new Date().toLocaleString('en-IN'), recipients: form.target === 'all_associates' ? 48 : 12,
    }
    setSent(prev => [entry, ...prev])
    toast.success(form.scheduled ? `Notification scheduled for ${form.scheduled_at}` : 'Notification sent successfully')
    setForm({ title: '', message: '', type: 'informational', target: 'all_associates', counsellor_id: '', scheduled: false, scheduled_at: '', ch_inapp: true, ch_email: false, ch_sms: false, ch_whatsapp: false })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Notification Manager</h2>
        <p className="text-sm text-muted-foreground">Send custom notifications to all associates, specific counselor groups, or individuals.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose Panel */}
        <div className="border rounded-xl p-5 space-y-4 bg-white">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-blue-500" />Compose Notification</h3>

          <div>
            <Label>Notification Type</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as SentNotification['type'] }))}>
              <SelectTrigger className="mt-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${form.type === 'informational' ? 'bg-blue-500' : form.type === 'action_required' ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="informational">Informational</SelectItem>
                <SelectItem value="action_required">Action Required</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Title</Label>
            <Input placeholder="e.g. New Prospectus Available" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea placeholder="Write your notification message..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} className="mt-1" />
          </div>

          <div>
            <Label>Send To</Label>
            <Select value={form.target} onValueChange={v => setForm(f => ({ ...f, target: v ?? '' }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_associates">All Associates</SelectItem>
                <SelectItem value="counselor_associates">Specific Counselor&apos;s Associates</SelectItem>
                <SelectItem value="individual">Individual Associate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.target === 'counselor_associates' && (
            <div>
              <Label>Select Counselor</Label>
              <Select value={form.counsellor_id} onValueChange={v => setForm(f => ({ ...f, counsellor_id: v ?? '' }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choose counselor" /></SelectTrigger>
                <SelectContent>
                  {counsellors.filter(c => ['lead', 'counselor'].includes(c.role)).map(c => (
                    <SelectItem key={c.id} value={c.id ?? ''}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Channel toggles */}
          <div>
            <Label className="mb-2 block">Channels</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'ch_inapp', label: 'In-App', field: 'ch_inapp' as const },
                { key: 'ch_email', label: 'Email', field: 'ch_email' as const },
                { key: 'ch_sms', label: 'SMS', field: 'ch_sms' as const },
                { key: 'ch_whatsapp', label: 'WhatsApp', field: 'ch_whatsapp' as const },
              ].map(ch => (
                <div key={ch.key} className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${form[ch.field] ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                  <span className="text-sm">{ch.label}</span>
                  <Switch checked={form[ch.field]} onCheckedChange={v => setForm(f => ({ ...f, [ch.field]: v }))} />
                </div>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <Label className="cursor-pointer">Schedule for later</Label>
            </div>
            <Switch checked={form.scheduled} onCheckedChange={v => setForm(f => ({ ...f, scheduled: v }))} />
          </div>
          {form.scheduled && (
            <div>
              <Label>Send At</Label>
              <Input type="datetime-local" className="mt-1" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
            </div>
          )}

          <Button className="w-full" onClick={handleSend}>
            <Send className="w-4 h-4 mr-2" />{form.scheduled ? 'Schedule Notification' : 'Send Now'}
          </Button>
        </div>

        {/* History Panel */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><CheckCheck className="w-4 h-4 text-green-500" />Notification History</h3>
          {sent.map(n => (
            <div key={n.id} className="border rounded-xl p-4 bg-white space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                </div>
                <Badge className={`${TYPE_COLORS[n.type]} border-0 text-xs flex-shrink-0`}>{n.type.replace('_', ' ')}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{n.target}</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{n.channels.join(', ')}</span>
                <span className="flex items-center gap-1"><User className="w-3 h-3" />{n.recipients} recipients</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{n.sent_at}</span>
              </div>
            </div>
          ))}
          {sent.length === 0 && <div className="text-center py-10 text-slate-400 border rounded-xl">No notifications sent yet</div>}
        </div>
      </div>
    </div>
  )
}

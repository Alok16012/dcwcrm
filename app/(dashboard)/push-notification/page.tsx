'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Bell, Send } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

export default function PushNotificationPage() {
  const supabase = createClient()
  const db = supabase as any

  const [notifTitle, setNotifTitle] = useState('')
  const [notifMessage, setNotifMessage] = useState('')
  const [notifSending, setNotifSending] = useState(false)
  const [notifHistory, setNotifHistory] = useState<{ id: string; title: string; message: string; created_at: string }[]>([])
  const [notifHistoryLoading, setNotifHistoryLoading] = useState(false)

  const loadNotifHistory = useCallback(async () => {
    setNotifHistoryLoading(true)
    const { data } = await db
      .from('associate_notifications')
      .select('id, title, message, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    const seen = new Set<string>()
    const unique = (data ?? []).filter((n: any) => {
      const key = `${n.title}||${n.created_at.slice(0, 16)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 15)
    setNotifHistory(unique)
    setNotifHistoryLoading(false)
  }, [db])

  useEffect(() => { loadNotifHistory() }, [loadNotifHistory])

  async function handleSendNotif() {
    if (!notifTitle.trim() || !notifMessage.trim()) { toast.error('Title and message required'); return }
    setNotifSending(true)
    try {
      const res = await fetch('/api/associates/notify-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: notifTitle, message: notifMessage }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to send'); return }
      toast.success(`Notification sent to ${data.sent} associate${data.sent !== 1 ? 's' : ''}`)
      setNotifTitle('')
      setNotifMessage('')
      loadNotifHistory()
    } finally { setNotifSending(false) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Push Notification" description="Broadcast notifications to all approved associates" />

      {/* Compose */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Send to All Approved Associates</h3>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Notification Title</Label>
          <Input
            placeholder="e.g. New offer available!"
            value={notifTitle}
            onChange={e => setNotifTitle(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Message</Label>
          <Textarea
            placeholder="Write your message here…"
            value={notifMessage}
            onChange={e => setNotifMessage(e.target.value)}
            rows={4}
            maxLength={500}
            className="resize-none"
          />
          <p className="text-xs text-slate-400 text-right">{notifMessage.length}/500</p>
        </div>
        <Button
          className="w-full gap-2"
          onClick={handleSendNotif}
          disabled={notifSending || !notifTitle.trim() || !notifMessage.trim()}
        >
          {notifSending
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Send className="w-4 h-4" /> Send to All Associates</>
          }
        </Button>
      </div>

      {/* History */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Recent Notifications</h4>
        {notifHistoryLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
        ) : notifHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No notifications sent yet</div>
        ) : (
          <div className="space-y-2">
            {notifHistory.map(n => (
              <div key={n.id} className="bg-white border rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{n.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>
                  </div>
                  <p className="text-xs text-slate-400 flex-shrink-0 mt-0.5">
                    {new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    {' '}
                    {new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

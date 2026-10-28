'use client'
import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Notification { id: string; title: string; message: string; type: string; is_read: boolean; created_at: string; file_url?: string | null; category?: string | null }

const notifTypeColor: Record<string, string> = {
  info: 'border-blue-200 bg-blue-50',
  success: 'border-green-200 bg-green-50',
  warning: 'border-yellow-200 bg-yellow-50',
  alert: 'border-red-200 bg-red-50',
}

/** Tells the topbar bell to recount unread notifications. */
function announceChange() {
  window.dispatchEvent(new Event('student-notifications-changed'))
}

export default function NotificationsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [studentId, setStudentId] = useState<string | null>(null)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: s } = await supabase.from('students').select('id').eq('portal_user_id', user.id).single()
    if (!s) return
    setStudentId(s.id)
    const { data } = await supabase.from('student_notifications').select('*')
      .eq('student_id', s.id).order('created_at', { ascending: false }).limit(100)
    setItems((data ?? []) as Notification[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  async function markRead(n: Notification) {
    if (n.is_read) return
    setItems(list => list.map(x => (x.id === n.id ? { ...x, is_read: true } : x)))
    const { error } = await supabase.from('student_notifications').update({ is_read: true }).eq('id', n.id)
    if (error) { setItems(list => list.map(x => (x.id === n.id ? { ...x, is_read: false } : x))); return }
    announceChange()
  }

  async function markAllRead() {
    if (!studentId) return
    const { error } = await supabase.from('student_notifications').update({ is_read: true }).eq('student_id', studentId).eq('is_read', false)
    if (error) { toast.error(error.message); return }
    setItems(list => list.map(x => ({ ...x, is_read: true })))
    announceChange()
    toast.success('All marked as read')
  }

  const unread = items.filter(n => !n.is_read).length
  const shown = filter === 'unread' ? items.filter(n => !n.is_read) : items

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500 mt-0.5">Updates about your admission, fees, exams and dispatch</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {f}{f === 'unread' && unread > 0 ? ` (${unread})` : ''}
            </button>
          ))}
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={markAllRead}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Bell className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{filter === 'unread' ? 'You\'re all caught up' : 'No notifications yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(n => (
            <div key={n.id} onClick={() => markRead(n)}
              className={cn('border rounded-2xl p-4', notifTypeColor[n.type] ?? 'bg-gray-50 border-gray-100',
                !n.is_read && 'ring-1 ring-blue-200 cursor-pointer')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn('text-sm font-semibold', n.is_read ? 'text-gray-600' : 'text-gray-900')}>{n.title}</p>
                    {n.category && (
                      <span className="text-[10px] px-2 py-0.5 bg-white/70 border border-gray-200 rounded-full text-gray-500 font-medium">{n.category}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{n.message}</p>
                  {n.file_url && (
                    <a href={n.file_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-600 font-medium hover:text-blue-800 hover:underline underline-offset-2">
                      <Paperclip className="h-3 w-3" /> View attachment
                    </a>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  {!n.is_read && <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1" aria-label="Unread" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { BellOff, CheckCircle2 } from 'lucide-react'

interface Notif {
  id: string
  title: string
  message: string | null
  is_read: boolean
  created_at: string
}

export default function AssociateNotificationsPage() {
  const supabase = createClient()
  const db = supabase as any
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [assocId, setAssocId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: assoc } = await db.from('associates').select('id').eq('user_id', user.id).single()
    if (!assoc) { setLoading(false); return }
    setAssocId(assoc.id)
    const { data } = await db.from('associate_notifications').select('*').eq('associate_id', assoc.id).order('created_at', { ascending: false })
    setNotifs((data ?? []) as Notif[])
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  async function markRead(id: string) {
    await db.from('associate_notifications').update({ is_read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    if (!assocId) return
    const ids = notifs.filter(n => !n.is_read).map(n => n.id)
    if (!ids.length) return
    await db.from('associate_notifications').update({ is_read: true }).in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    toast.success('All marked as read')
  }

  const unread = notifs.filter(n => !n.is_read).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{notifs.length} total · {unread} unread</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5 h-8 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : notifs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-white">
          <BellOff className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map(n => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className={`rounded-xl border p-4 cursor-pointer transition-colors ${n.is_read ? 'bg-white' : 'bg-blue-50 border-blue-200 hover:bg-blue-100'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.is_read ? 'bg-slate-200' : 'bg-blue-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${n.is_read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</p>
                  {n.message && <p className="text-xs text-muted-foreground mt-1">{n.message}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

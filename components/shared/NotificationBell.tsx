'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, CheckCircle2, Clock, AlertTriangle, Zap, Info, CheckCheck, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface TaskNotif {
  id: string
  title: string
  due_date: string
  urgency: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'done'
  created_by_name: string
}

interface GeneralNotif {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'alert'
  created_at: string
  read: boolean
}

const URGENCY_ICON: Record<string, React.ReactNode> = {
  low:    <Clock className="w-3.5 h-3.5 text-slate-400" />,
  medium: <Clock className="w-3.5 h-3.5 text-blue-500" />,
  high:   <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />,
  urgent: <Zap className="w-3.5 h-3.5 text-red-500" />,
}
const URGENCY_DOT: Record<string, string> = {
  low: 'bg-slate-300', medium: 'bg-blue-400', high: 'bg-orange-400', urgent: 'bg-red-500',
}
const TYPE_COLOR: Record<string, string> = {
  info:    'bg-blue-50 border-blue-100 text-blue-700',
  warning: 'bg-amber-50 border-amber-100 text-amber-700',
  success: 'bg-green-50 border-green-100 text-green-700',
  alert:   'bg-red-50 border-red-100 text-red-700',
}

function fmtDate(d: string) {
  const today = new Date().toISOString().slice(0, 10)
  const date  = new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  if (d === today) return 'Due today'
  if (d < today)  return `Overdue · ${date}`
  return `Due ${date}`
}

export function NotificationBell({ userId, role }: { userId: string; role: string }) {
  const supabase = createClient()
  const db = supabase as any

  const [open, setOpen] = useState(false)
  const [tasks, setTasks]   = useState<TaskNotif[]>([])
  const [notifs, setNotifs] = useState<GeneralNotif[]>([])

  const load = useCallback(async () => {
    if (!userId) return
    const today = new Date().toISOString().slice(0, 10)

    // Active tasks assigned to me (pending or in_progress)
    const { data: taskData } = await db
      .from('tasks')
      .select('id, title, due_date, urgency, status, created_by_name')
      .eq('assigned_to', userId)
      .in('status', ['pending', 'in_progress'])
      .order('due_date')
      .limit(15)

    setTasks(taskData ?? [])

    // General notifications — broadcast or targeted to my role
    const { data: notifData } = await db
      .from('notifications')
      .select('id, title, message, type, created_at')
      .or(`target_role.is.null,target_role.eq.${role}`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (notifData) {
      // Check which ones I've already read
      const ids = (notifData as { id: string }[]).map(n => n.id)
      const { data: reads } = ids.length > 0
        ? await db.from('notification_reads').select('notification_id').eq('user_id', userId).in('notification_id', ids)
        : { data: [] }
      const readSet = new Set((reads ?? []).map((r: { notification_id: string }) => r.notification_id))
      setNotifs((notifData as GeneralNotif[]).map(n => ({ ...n, read: readSet.has(n.id) })))
    }
  }, [userId, role])

  useEffect(() => { load() }, [load])

  // Real-time: re-fetch when tasks table changes for this user
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notif-tasks-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `assigned_to=eq.${userId}` }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, load])

  async function markRead(notifId: string) {
    await db.from('notification_reads').upsert({ notification_id: notifId, user_id: userId })
    setNotifs(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    const unread = notifs.filter(n => !n.read)
    if (!unread.length) return
    await db.from('notification_reads').upsert(
      unread.map(n => ({ notification_id: n.id, user_id: userId }))
    )
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    toast.success('All notifications marked as read')
  }

  const today = new Date().toISOString().slice(0, 10)
  const overdueTasks  = tasks.filter(t => t.due_date < today)
  const urgentTasks   = tasks.filter(t => t.urgency === 'urgent')
  const unreadNotifs  = notifs.filter(n => !n.read).length
  const totalBadge    = tasks.length + unreadNotifs

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {totalBadge > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {totalBadge > 99 ? '99+' : totalBadge}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-10 z-50 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-600" />
                <span className="font-semibold text-sm text-gray-800">Notifications</span>
                {totalBadge > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalBadge}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadNotifs > 0 && (
                  <button onClick={markAllRead} className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 mr-1">
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-200 transition-colors">
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[440px]">

              {/* ── TASK NOTIFICATIONS ── */}
              {tasks.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">My Tasks</p>
                    <span className="text-[11px] text-gray-400">{tasks.length} active</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {tasks.map(task => {
                      const isOverdue  = task.due_date < today
                      const isDueToday = task.due_date === today
                      return (
                        <div key={task.id} className={`px-4 py-3 hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/40' : ''}`}>
                          <div className="flex items-start gap-2.5">
                            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${URGENCY_DOT[task.urgency]}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 leading-tight truncate">{task.title}</p>
                              <p className="text-xs text-gray-400 mt-0.5 truncate">By {task.created_by_name}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                {URGENCY_ICON[task.urgency]}
                                <span className={`text-[11px] font-medium ${isOverdue ? 'text-red-600' : isDueToday ? 'text-orange-600' : 'text-gray-500'}`}>
                                  {fmtDate(task.due_date)}
                                </span>
                                {task.status === 'in_progress' && (
                                  <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">In Progress</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── GENERAL NOTIFICATIONS ── */}
              {notifs.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1.5 flex items-center justify-between border-t">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">General</p>
                    {unreadNotifs > 0 && (
                      <span className="text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{unreadNotifs} new</span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {notifs.map(n => (
                      <div key={n.id}
                        className={`px-4 py-3 transition-colors cursor-pointer ${n.read ? 'hover:bg-gray-50' : 'bg-blue-50/50 hover:bg-blue-50'}`}
                        onClick={() => !n.read && markRead(n.id)}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`mt-0.5 p-1 rounded-md border flex-shrink-0 ${TYPE_COLOR[n.type]}`}>
                            <Info className="w-3 h-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm leading-tight ${n.read ? 'text-gray-600 font-normal' : 'text-gray-900 font-semibold'}`}>{n.title}</p>
                              {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {tasks.length === 0 && notifs.length === 0 && (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">All caught up!</p>
                  <p className="text-xs text-gray-400 mt-1">No pending tasks or notifications</p>
                </div>
              )}
            </div>

            {/* Footer quick link */}
            {tasks.length > 0 && (
              <div className="border-t px-4 py-2.5 bg-gray-50">
                <a href="/tasks" className="text-xs text-blue-600 hover:underline font-medium" onClick={() => setOpen(false)}>
                  View all tasks →
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

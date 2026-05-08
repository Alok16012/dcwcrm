'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Truck } from 'lucide-react'

interface Dispatch {
  id: string
  item_name: string
  quantity: number
  tracking_number: string | null
  status: 'processing' | 'shipped' | 'delivered'
  dispatched_at: string | null
  created_at: string
}

export default function AssociateDispatchPage() {
  const supabase = createClient()
  const db = supabase as any
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: assoc } = await db.from('associates').select('id').eq('user_id', user.id).single()
    if (!assoc) { setLoading(false); return }
    const { data } = await db.from('associate_dispatches').select('*').eq('associate_id', assoc.id).order('created_at', { ascending: false })
    setDispatches((data ?? []) as Dispatch[])
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dispatch</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kits and materials dispatched to you from DCW</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : dispatches.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-white">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No dispatches yet</p>
          <p className="text-xs mt-1">Items dispatched to you will appear here</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Item</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Qty</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Tracking No.</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Date</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dispatches.map(d => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{d.item_name}</td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{d.quantity}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden md:table-cell">{d.tracking_number ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                    {new Date(d.dispatched_at ?? d.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d.status === 'delivered'
                      ? <Badge className="bg-green-100 text-green-800 border-0 text-xs">Delivered</Badge>
                      : d.status === 'shipped'
                      ? <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">Shipped</Badge>
                      : <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Processing</Badge>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

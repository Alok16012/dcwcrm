'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, Truck, CheckCircle2, Clock, MapPin, RefreshCw } from 'lucide-react'

interface Dispatch {
  id: string
  document_type: string
  courier: string | null
  tracking_number: string | null
  status: string
  dispatch_date: string | null
  expected_delivery: string | null
  delivery_address: string | null
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:    { label: 'Pending',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',  icon: Clock },
  dispatched: { label: 'Dispatched', color: 'bg-blue-100 text-blue-700 border-blue-200',         icon: Truck },
  in_transit: { label: 'In Transit', color: 'bg-indigo-100 text-indigo-700 border-indigo-200',   icon: Truck },
  delivered:  { label: 'Delivered',  color: 'bg-green-100 text-green-700 border-green-200',      icon: CheckCircle2 },
  returned:   { label: 'Returned',   color: 'bg-red-100 text-red-700 border-red-200',            icon: Package },
  failed:     { label: 'Failed',     color: 'bg-red-100 text-red-700 border-red-200',            icon: Package },
}

export default function StudentDispatchPage() {
  const supabase = createClient() as any
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/student/login'; return }

    const { data: s } = await supabase
      .from('students')
      .select('enrollment_number')
      .eq('portal_user_id', user.id)
      .single()
    if (!s) { window.location.href = '/student/login'; return }

    const { data } = await supabase
      .from('student_dispatches')
      .select('id, document_type, courier, tracking_number, status, dispatch_date, expected_delivery, delivery_address')
      .eq('enrollment_number', s.enrollment_number)
      .order('created_at', { ascending: false })
    setDispatches((data ?? []) as Dispatch[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dispatch Tracking</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your documents and deliveries</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',     value: dispatches.length,                                      color: 'text-gray-700',   bg: 'bg-gray-50',    border: 'border-gray-200' },
          { label: 'In Transit', value: dispatches.filter(d => ['dispatched','in_transit'].includes(d.status)).length, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Delivered', value: dispatches.filter(d => d.status === 'delivered').length, color: 'text-green-700', bg: 'bg-green-50',   border: 'border-green-100' },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className={`${bg} border ${border} rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className={`text-xs font-medium ${color} mt-0.5 opacity-70`}>{label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {dispatches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <Package className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-400">No dispatch records yet</p>
          <p className="text-sm text-gray-300 mt-1">Your documents will appear here once dispatched.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dispatches.map(d => {
            const cfg = STATUS_CFG[d.status] ?? { label: d.status, color: 'bg-gray-100 text-gray-600 border-gray-200', icon: Package }
            const Icon = cfg.icon
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 capitalize">
                        {d.document_type.replace(/_/g, ' ')}
                      </p>
                      {d.courier && (
                        <p className="text-xs text-gray-500 mt-0.5">{d.courier}</p>
                      )}
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color} shrink-0`}>
                    <Icon className="h-3 w-3" /> {cfg.label}
                  </span>
                </div>

                {d.tracking_number && (
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 mb-3">
                    <Truck className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Tracking Number</p>
                      <p className="text-sm font-bold text-gray-800 font-mono">{d.tracking_number}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  {d.dispatch_date && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Dispatched: {new Date(d.dispatch_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                  {d.expected_delivery && (
                    <span className="flex items-center gap-1 text-blue-600 font-medium">
                      <Truck className="h-3 w-3" />
                      Expected: {new Date(d.expected_delivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                  {d.delivery_address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {d.delivery_address}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-800 mb-1">📦 Need help with your delivery?</p>
        <p className="text-xs text-blue-700">Contact support at <strong>9939587009</strong> or raise a ticket in Help & Support.</p>
      </div>
    </div>
  )
}

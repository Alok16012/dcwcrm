'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, Package, CheckCircle2, Clock, AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

const DOCUMENT_LABELS: Record<string, string> = {
  marksheet: 'Marksheet',
  certificate: 'Certificate',
  id_card: 'ID Card',
  enrollment_letter: 'Enrollment Letter',
  admit_card: 'Admit Card',
  degree: 'Degree / Diploma',
  other: 'Other',
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:    { label: 'Pending',    color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock },
  dispatched: { label: 'Dispatched', color: 'bg-blue-100 text-blue-700 border-blue-200',   icon: Truck },
  in_transit: { label: 'In Transit', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Package },
  delivered:  { label: 'Delivered',  color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  returned:   { label: 'Returned',   color: 'bg-orange-100 text-orange-700 border-orange-200', icon: RotateCcw },
  failed:     { label: 'Failed',     color: 'bg-red-100 text-red-700 border-red-200',       icon: AlertTriangle },
}

interface Dispatch {
  id: string
  student_name: string
  enrollment_number: string | null
  document_type: string
  courier: string | null
  tracking_number: string | null
  dispatch_date: string | null
  expected_delivery: string | null
  status: string
  remarks: string | null
  created_at: string
}

export default function AssociateDispatchPage() {
  const supabase = createClient()
  const db = supabase as any
  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: assoc } = await db.from('associates').select('id').eq('user_id', user.id).single()
    if (!assoc) { setLoading(false); return }
    const { data } = await db
      .from('student_dispatches')
      .select('*')
      .eq('associate_id', assoc.id)
      .order('created_at', { ascending: false })
    setDispatches((data ?? []) as Dispatch[])
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  const filtered = filterStatus ? dispatches.filter(d => d.status === filterStatus) : dispatches

  const counts = Object.keys(STATUS_META).reduce((acc, s) => {
    acc[s] = dispatches.filter(d => d.status === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dispatch</h1>
          <p className="text-xs text-gray-400 mt-0.5">Documents dispatched for your students</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status filter pills */}
      <div className="overflow-x-auto -mx-1 px-1 pb-0.5">
        <div className="flex items-center gap-2 w-max">
          <button
            onClick={() => setFilterStatus('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${!filterStatus ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            All ({dispatches.length})
          </button>
          {Object.entries(STATUS_META).map(([k, v]) => counts[k] > 0 && (
            <button
              key={k}
              onClick={() => setFilterStatus(f => f === k ? '' : k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${filterStatus === k ? v.color + ' ring-2 ring-offset-1 ring-blue-400' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {v.label} ({counts[k]})
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : dispatches.length === 0 ? (
        <div className="text-center py-16 border rounded-xl bg-white">
          <Truck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">No dispatches yet</p>
          <p className="text-xs text-gray-400 mt-1">Documents dispatched for your students will appear here</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-white">
          <p className="text-sm text-gray-400">No dispatches with this status</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(d => {
              const sm = STATUS_META[d.status] ?? STATUS_META.pending
              const Icon = sm.icon
              const docLabel = DOCUMENT_LABELS[d.document_type] ?? d.document_type
              const today = new Date().toISOString().slice(0, 10)
              const isOverdue = d.expected_delivery && d.expected_delivery < today && !['delivered', 'returned', 'failed'].includes(d.status)
              return (
                <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  {/* Top: name + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 leading-tight">{d.student_name}</p>
                      {d.enrollment_number && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5">#{d.enrollment_number}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${sm.color}`}>
                      <Icon className="w-3 h-3" />
                      {sm.label}
                    </span>
                  </div>

                  {/* Doc type + courier */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[11px] bg-purple-50 text-purple-700 border border-purple-100 rounded-md px-2 py-0.5">{docLabel}</span>
                    {d.courier && <span className="text-[11px] bg-gray-50 text-gray-600 border border-gray-200 rounded-md px-2 py-0.5">{d.courier}</span>}
                  </div>

                  {/* Tracking */}
                  {d.tracking_number && (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <Package className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">Tracking Number</p>
                        <p className="font-mono text-sm font-bold text-blue-800">{d.tracking_number}</p>
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="flex items-center gap-4 text-xs">
                    {d.dispatch_date && (
                      <div>
                        <p className="text-gray-400">Dispatched</p>
                        <p className="font-medium text-gray-700">{format(new Date(d.dispatch_date + 'T00:00:00'), 'dd MMM yyyy')}</p>
                      </div>
                    )}
                    {d.expected_delivery && (
                      <div>
                        <p className="text-gray-400">Expected</p>
                        <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                          {format(new Date(d.expected_delivery + 'T00:00:00'), 'dd MMM yyyy')}
                          {isOverdue && ' ⚠️'}
                        </p>
                      </div>
                    )}
                  </div>

                  {d.remarks && (
                    <p className="text-xs text-gray-400 italic border-t pt-2">{d.remarks}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Student</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Document</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Courier / Tracking</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Dispatch Date</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Expected</th>
                  <th className="text-center px-5 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(d => {
                  const sm = STATUS_META[d.status] ?? STATUS_META.pending
                  const Icon = sm.icon
                  const docLabel = DOCUMENT_LABELS[d.document_type] ?? d.document_type
                  const today = new Date().toISOString().slice(0, 10)
                  const isOverdue = d.expected_delivery && d.expected_delivery < today && !['delivered', 'returned', 'failed'].includes(d.status)
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{d.student_name}</p>
                        {d.enrollment_number && <p className="text-xs font-mono text-gray-400">#{d.enrollment_number}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-purple-50 text-purple-700 border border-purple-100 rounded-md px-2 py-0.5">{docLabel}</span>
                      </td>
                      <td className="px-5 py-3">
                        {d.courier && <p className="text-xs text-gray-600">{d.courier}</p>}
                        {d.tracking_number && <p className="text-xs font-mono font-semibold text-blue-700">{d.tracking_number}</p>}
                        {!d.courier && !d.tracking_number && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {d.dispatch_date ? format(new Date(d.dispatch_date + 'T00:00:00'), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className={`px-5 py-3 text-xs whitespace-nowrap ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                        {d.expected_delivery ? format(new Date(d.expected_delivery + 'T00:00:00'), 'dd MMM yyyy') : '—'}
                        {isOverdue && ' ⚠️'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sm.color}`}>
                          <Icon className="w-3 h-3" />
                          {sm.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-5 py-2 border-t bg-slate-50 text-xs text-slate-500">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</div>
          </div>
        </>
      )}
    </div>
  )
}

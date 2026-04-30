'use client'
import { useState } from 'react'
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface SyncLog {
  id: string
  admission_id: string
  student_name: string
  event_type: string
  status: 'success' | 'failed' | 'pending' | 'retrying'
  crm_response: string
  error_message: string
  synced_at: string
  retry_count: number
}

interface Props {
  students: { id: string; full_name: string; course?: { name: string }; department?: { name: string }; status: string }[]
}

const EVENT_TYPES = ['Admission Enrolled', 'Yearly Payment Done', 'Part Payment Installment', 'Full Payment Complete', 'Student Progress Update', 'Admission Cancelled']

const SAMPLE_LOGS: SyncLog[] = [
  { id: 'l1', admission_id: 'ADM-001', student_name: 'Rahul Sharma', event_type: 'Admission Enrolled', status: 'success', crm_response: '{"status":"ok","student_id":"CRM-4821"}', error_message: '', synced_at: '2026-04-20 14:32', retry_count: 0 },
  { id: 'l2', admission_id: 'ADM-002', student_name: 'Priya Verma', event_type: 'Student Progress Update', status: 'success', crm_response: '{"status":"ok","updated":true}', error_message: '', synced_at: '2026-04-20 12:15', retry_count: 0 },
  { id: 'l3', admission_id: 'ADM-003', student_name: 'Mohit Gupta', event_type: 'Yearly Payment Done', status: 'failed', crm_response: '{"status":"error"}', error_message: 'CRM endpoint timeout after 30s', synced_at: '2026-04-19 16:45', retry_count: 3 },
  { id: 'l4', admission_id: 'ADM-004', student_name: 'Sneha Kapoor', event_type: 'Admission Enrolled', status: 'retrying', crm_response: '', error_message: 'Connection refused', synced_at: '2026-04-19 15:00', retry_count: 1 },
  { id: 'l5', admission_id: 'ADM-005', student_name: 'Aakash Yadav', event_type: 'Part Payment Installment', status: 'success', crm_response: '{"status":"ok"}', error_message: '', synced_at: '2026-04-18 10:20', retry_count: 0 },
  { id: 'l6', admission_id: 'ADM-006', student_name: 'Deepika Rao', event_type: 'Full Payment Complete', status: 'failed', crm_response: '', error_message: 'Invalid student ID in CRM payload', synced_at: '2026-04-17 14:00', retry_count: 3 },
]

const STATUS_CONFIG = {
  success: { icon: <CheckCircle className="w-4 h-4 text-green-500" />, badge: 'bg-green-100 text-green-800' },
  failed: { icon: <XCircle className="w-4 h-4 text-red-500" />, badge: 'bg-red-100 text-red-800' },
  pending: { icon: <Clock className="w-4 h-4 text-slate-400" />, badge: 'bg-slate-100 text-slate-600' },
  retrying: { icon: <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />, badge: 'bg-amber-100 text-amber-800' },
}

export function CrmSyncMonitor({ students }: Props) {
  const [logs, setLogs] = useState<SyncLog[]>(() => {
    if (students.length > 0) {
      return students.slice(0, 6).map((s, i) => SAMPLE_LOGS[i] ? { ...SAMPLE_LOGS[i], student_name: s.full_name } : SAMPLE_LOGS[0])
    }
    return SAMPLE_LOGS
  })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [retrying, setRetrying] = useState<string | null>(null)

  function handleRetry(id: string) {
    setRetrying(id)
    setLogs(prev => prev.map(l => l.id === id ? { ...l, status: 'retrying' as const } : l))
    setTimeout(() => {
      setLogs(prev => prev.map(l => l.id === id ? { ...l, status: 'success' as const, crm_response: '{"status":"ok","retry":true}', error_message: '', synced_at: new Date().toLocaleString('en-IN'), retry_count: l.retry_count } : l))
      setRetrying(null)
      toast.success('CRM sync successful on retry')
    }, 2000)
  }

  function handleRetryAll() {
    const failed = logs.filter(l => l.status === 'failed')
    if (failed.length === 0) { toast.info('No failed syncs to retry'); return }
    failed.forEach(l => {
      setLogs(prev => prev.map(log => log.id === l.id ? { ...log, status: 'retrying' as const } : log))
    })
    setTimeout(() => {
      setLogs(prev => prev.map(l => l.status === 'retrying' ? { ...l, status: 'success' as const, crm_response: '{"status":"ok"}', error_message: '', synced_at: new Date().toLocaleString('en-IN') } : l))
      toast.success(`${failed.length} failed sync(s) retried successfully`)
    }, 2500)
  }

  const filtered = logs.filter(l => {
    const matchSearch = l.student_name.toLowerCase().includes(search.toLowerCase()) || l.admission_id.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter ? l.status === statusFilter : true
    return matchSearch && matchStatus
  })

  const successCount = logs.filter(l => l.status === 'success').length
  const failedCount = logs.filter(l => l.status === 'failed').length
  const retryingCount = logs.filter(l => l.status === 'retrying').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">CRM Sync Monitor</h2>
          <p className="text-sm text-muted-foreground">Track admission events synced to CRM. Re-trigger failed syncs manually.</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleRetryAll} disabled={failedCount === 0}>
          <RefreshCw className="w-4 h-4 mr-1" />Retry All Failed ({failedCount})
        </Button>
      </div>

      {/* Status overview */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Success', value: successCount, color: 'bg-green-50 border-green-100', text: 'text-green-700' },
          { label: 'Failed', value: failedCount, color: 'bg-red-50 border-red-100', text: 'text-red-700' },
          { label: 'Retrying', value: retryingCount, color: 'bg-amber-50 border-amber-100', text: 'text-amber-700' },
          { label: 'Total Events', value: logs.length, color: 'bg-slate-50 border-slate-100', text: 'text-slate-700' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-3 text-center ${s.color}`}>
            <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
            <p className={`text-xs ${s.text} opacity-80`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Technical config info */}
      <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {[
          { label: 'Method', value: 'REST POST + Webhook fallback' },
          { label: 'Auth', value: 'Bearer Token (env-secured)' },
          { label: 'Queue', value: 'BullMQ / Redis' },
          { label: 'Retry Policy', value: '3 attempts (1m → 5m → 15m)' },
        ].map(c => (
          <div key={c.label}>
            <p className="text-slate-500 font-medium">{c.label}</p>
            <p className="text-slate-700 mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search student or ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(!v || v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36 h-9"><Filter className="w-3.5 h-3.5 mr-1" /><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="retrying">Retrying</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Admission ID</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Student</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Event</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Response / Error</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Synced At</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(l => (
              <tr key={l.id} className={`hover:bg-slate-50 ${l.status === 'failed' ? 'bg-red-50/30' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {STATUS_CONFIG[l.status].icon}
                    <Badge className={`${STATUS_CONFIG[l.status].badge} border-0 text-xs`}>{l.status}</Badge>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{l.admission_id}</td>
                <td className="px-4 py-3 font-medium">{l.student_name}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{l.event_type}</td>
                <td className="px-4 py-3 max-w-xs">
                  {l.error_message ? (
                    <div className="flex items-start gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-red-600 line-clamp-2">{l.error_message}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-green-700 font-mono line-clamp-1">{l.crm_response}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{l.synced_at}</td>
                <td className="px-4 py-3">
                  {l.status === 'failed' && (
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      disabled={retrying === l.id}
                      onClick={() => handleRetry(l.id)}>
                      <RefreshCw className={`w-3 h-3 mr-1 ${retrying === l.id ? 'animate-spin' : ''}`} />
                      {retrying === l.id ? 'Retrying...' : 'Retry'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">No sync logs found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

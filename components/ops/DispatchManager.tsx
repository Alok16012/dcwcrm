'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  Truck, Search, RefreshCw, ChevronDown, Pencil, Trash2,
  Package, X, ArrowDownToLine, Send, ChevronRight,
} from 'lucide-react'
import { format } from 'date-fns'

// ── Constants ────────────────────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  { value: 'marksheet',         label: 'Marksheet' },
  { value: 'certificate',       label: 'Certificate' },
  { value: 'id_card',           label: 'ID Card' },
  { value: 'enrollment_letter', label: 'Enrollment Letter' },
  { value: 'admit_card',        label: 'Admit Card' },
  { value: 'degree',            label: 'Degree / Diploma' },
  { value: 'other',             label: 'Other' },
]

const COURIERS = ['Speed Post', 'DTDC', 'Blue Dart', 'Delhivery', 'India Post', 'Ekart', 'Xpressbees', 'Other']

const INBOUND_STATUSES = [
  { value: 'pending',    label: 'Awaiting',   color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'dispatched', label: 'In Transit',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'delivered',  label: 'Received',    color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { value: 'returned',   label: 'Returned',    color: 'bg-orange-100 text-orange-700 border-orange-200' },
]

const OUTBOUND_STATUSES = [
  { value: 'pending',    label: 'Pending',    color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'dispatched', label: 'Dispatched', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'in_transit', label: 'In Transit', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'delivered',  label: 'Delivered',  color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'returned',   label: 'Returned',   color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'failed',     label: 'Failed',     color: 'bg-red-100 text-red-700 border-red-200' },
]

function statusMeta(status: string, type: string) {
  const opts = type === 'inbound' ? INBOUND_STATUSES : OUTBOUND_STATUSES
  return opts.find(o => o.value === status) ?? opts[0]
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentOption {
  id: string
  full_name: string
  enrollment_number: string
  phone: string
  lead_id: string | null
  referred_by_associate: string | null
  associate_name: string | null
  associate_id: string | null
}

interface Associate { id: string; name: string; associate_code: string | null }

interface Dispatch {
  id: string
  dispatch_type: 'inbound' | 'outbound'
  student_name: string
  enrollment_number: string | null
  associate_id: string | null
  associate?: { name: string; associate_code: string | null } | null
  document_type: string
  courier: string | null
  tracking_number: string | null
  dispatch_date: string | null
  expected_delivery: string | null
  status: string
  remarks: string | null
  created_at: string
}

const EMPTY_FORM = {
  dispatch_type: 'outbound' as 'inbound' | 'outbound',
  student_id: '',        // internal, not saved to DB
  student_name: '',
  enrollment_number: '',
  associate_id: '',
  document_type: 'marksheet',
  courier: '',
  tracking_number: '',
  dispatch_date: '',
  expected_delivery: '',
  status: 'pending',
  remarks: '',
}

// ── Student Search Combobox ───────────────────────────────────────────────────

function StudentCombobox({
  students,
  value,
  onChange,
}: {
  students: StudentOption[]
  value: string
  onChange: (s: StudentOption | null) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = students.find(s => s.id === value)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const filtered = query.length < 1
    ? students.slice(0, 50)
    : students.filter(s =>
        s.full_name.toLowerCase().includes(query.toLowerCase()) ||
        s.enrollment_number.toLowerCase().includes(query.toLowerCase()) ||
        s.phone.includes(query)
      ).slice(0, 30)

  function handleSelect(s: StudentOption) {
    onChange(s)
    setOpen(false)
    setQuery('')
  }

  function handleClear() {
    onChange(null)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{selected.full_name}</p>
            <p className="text-[11px] text-gray-400 font-mono">{selected.enrollment_number} · {selected.phone}</p>
          </div>
          <button onClick={handleClear} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, enrollment no. or phone…"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      )}

      {open && !selected && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center py-6 text-xs text-gray-400">No students found</p>
          ) : filtered.map(s => (
            <button
              key={s.id}
              onMouseDown={e => { e.preventDefault(); handleSelect(s) }}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <p className="text-sm font-medium text-gray-900">{s.full_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-gray-400 font-mono">{s.enrollment_number}</span>
                <span className="text-[11px] text-gray-400">{s.phone}</span>
                {s.associate_name && (
                  <span className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{s.associate_name}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DispatchManager() {
  const supabase = createClient()
  const db = supabase as any

  const [dispatches, setDispatches] = useState<Dispatch[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [associates, setAssociates] = useState<Associate[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'inbound' | 'outbound'>('all')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAssociate, setFilterAssociate] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<Dispatch | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [manualEntry, setManualEntry] = useState(false)
  const [showOptional, setShowOptional] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await db
      .from('student_dispatches')
      .select('*, associate:associates(name, associate_code)')
      .order('created_at', { ascending: false })
    setDispatches((data ?? []) as Dispatch[])
    setLoading(false)
  }, [db])

  const loadMeta = useCallback(async () => {
    // Load students with their associate info via lead
    const { data: studs } = await db
      .from('students')
      .select('id, full_name, enrollment_number, phone, lead_id, leads(referred_by_associate, associates:referred_by_associate(id, name, associate_code))')
      .order('full_name')

    const mapped: StudentOption[] = (studs ?? []).map((s: any) => ({
      id: s.id,
      full_name: s.full_name,
      enrollment_number: s.enrollment_number ?? '',
      phone: s.phone ?? '',
      lead_id: s.lead_id ?? null,
      referred_by_associate: s.leads?.referred_by_associate ?? null,
      associate_id: s.leads?.associates?.id ?? null,
      associate_name: s.leads?.associates?.name ?? null,
    }))
    setStudents(mapped)

    const { data: assocs } = await db.from('associates').select('id, name, associate_code').eq('status', 'approved').order('name')
    setAssociates((assocs ?? []) as Associate[])
  }, [db])

  useEffect(() => { load(); loadMeta() }, [load, loadMeta])

  function openAdd(type: 'inbound' | 'outbound') {
    setEditItem(null)
    setForm({ ...EMPTY_FORM, dispatch_type: type })
    setManualEntry(false)
    setShowOptional(false)
    setFormOpen(true)
  }

  function openEdit(d: Dispatch) {
    setEditItem(d)
    setForm({
      dispatch_type: d.dispatch_type,
      student_id: '',
      student_name: d.student_name,
      enrollment_number: d.enrollment_number ?? '',
      associate_id: d.associate_id ?? '',
      document_type: d.document_type,
      courier: d.courier ?? '',
      tracking_number: d.tracking_number ?? '',
      dispatch_date: d.dispatch_date ?? '',
      expected_delivery: d.expected_delivery ?? '',
      status: d.status,
      remarks: d.remarks ?? '',
    })
    setShowOptional(!!(d.courier || d.tracking_number || d.expected_delivery || d.remarks))
    setFormOpen(true)
  }

  function handleStudentSelect(s: StudentOption | null) {
    if (!s) {
      setForm(p => ({ ...p, student_id: '', student_name: '', enrollment_number: '', associate_id: '' }))
      return
    }
    setForm(p => ({
      ...p,
      student_id: s.id,
      student_name: s.full_name,
      enrollment_number: s.enrollment_number,
      associate_id: s.associate_id ?? p.associate_id,
    }))
  }

  async function handleSave() {
    if (!form.student_name.trim()) { toast.error('Please select a student'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      dispatch_type: form.dispatch_type,
      student_name: form.student_name.trim(),
      enrollment_number: form.enrollment_number.trim() || null,
      associate_id: form.associate_id || null,
      document_type: form.document_type,
      courier: form.courier || null,
      tracking_number: form.tracking_number.trim() || null,
      dispatch_date: form.dispatch_date || null,
      expected_delivery: form.expected_delivery || null,
      status: form.status,
      remarks: form.remarks.trim() || null,
      dispatched_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    }
    try {
      if (editItem) {
        const { error } = await db.from('student_dispatches').update(payload).eq('id', editItem.id)
        if (error) { toast.error(error.message); return }
        toast.success('Updated')
      } else {
        const { error } = await db.from('student_dispatches').insert(payload)
        if (error) { toast.error(error.message); return }
        toast.success(form.dispatch_type === 'inbound' ? 'Receive entry added' : 'Dispatch entry added')
      }
      setFormOpen(false)
      load()
    } finally { setSaving(false) }
  }

  async function handleStatusChange(id: string, newStatus: string, dtype: string) {
    const { error } = await db.from('student_dispatches').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error('Failed to update'); return }
    toast.success('Status updated')
    setDispatches(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this entry?')) return
    const { error } = await db.from('student_dispatches').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Deleted')
    setDispatches(prev => prev.filter(d => d.id !== id))
  }

  const tabFiltered = dispatches.filter(d => activeTab === 'all' || d.dispatch_type === activeTab)
  const filtered = tabFiltered.filter(d => {
    const q = search.toLowerCase()
    const matchSearch = !q || d.student_name.toLowerCase().includes(q) || (d.enrollment_number ?? '').toLowerCase().includes(q) || (d.tracking_number ?? '').toLowerCase().includes(q) || (d.associate?.name ?? '').toLowerCase().includes(q)
    const matchStatus = !filterStatus || d.status === filterStatus
    const matchAssoc = !filterAssociate || d.associate_id === filterAssociate
    return matchSearch && matchStatus && matchAssoc
  })

  const inboundCount  = dispatches.filter(d => d.dispatch_type === 'inbound').length
  const outboundCount = dispatches.filter(d => d.dispatch_type === 'outbound').length
  const currentStatuses = activeTab === 'inbound' ? INBOUND_STATUSES : activeTab === 'outbound' ? OUTBOUND_STATUSES : [...new Map([...INBOUND_STATUSES, ...OUTBOUND_STATUSES].map(s => [s.value, s])).values()]

  // Student selected in form
  const formStudentObj = students.find(s => s.id === form.student_id) ?? null

  return (
    <div className="space-y-4">

      {/* ── Type Tabs ── */}
      <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        {([
          { key: 'all',      label: `All (${dispatches.length})` },
          { key: 'inbound',  label: `Received (${inboundCount})` },
          { key: 'outbound', label: `Dispatched (${outboundCount})` },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setFilterStatus('') }}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {currentStatuses.slice(0, 4).map(s => {
          const count = tabFiltered.filter(d => d.status === s.value).length
          return (
            <button
              key={s.value}
              onClick={() => setFilterStatus(f => f === s.value ? '' : s.value)}
              className={`rounded-xl border px-3 py-2.5 text-center transition-all ${filterStatus === s.value ? s.color + ' ring-2 ring-offset-1 ring-blue-400' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
            >
              <p className="text-xl font-bold text-gray-900">{count}</p>
              <p className="text-[10px] font-medium text-gray-500 leading-tight mt-0.5">{s.label}</p>
            </button>
          )
        })}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search student, tracking…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-3.5 h-3.5" /></button>}
        </div>

        {associates.length > 0 && (
          <select
            value={filterAssociate}
            onChange={e => setFilterAssociate(e.target.value)}
            className="h-9 px-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none"
          >
            <option value="">All Associates</option>
            {associates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}

        <Button variant="outline" size="sm" onClick={load} className="h-9 px-2.5">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>

        <Button size="sm" onClick={() => openAdd('inbound')} className="gap-1.5 h-9 bg-teal-600 hover:bg-teal-700">
          <ArrowDownToLine className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Received</span>
          <span className="sm:hidden">Received</span>
        </Button>
        <Button size="sm" onClick={() => openAdd('outbound')} className="gap-1.5 h-9">
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Dispatch</span>
          <span className="sm:hidden">Dispatch</span>
        </Button>
      </div>

      {(search || filterStatus || filterAssociate) && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterAssociate('') }} className="text-red-500 hover:text-red-700 flex items-center gap-0.5">
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-xl bg-white">
          <Truck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">{dispatches.length === 0 ? 'No entries yet' : 'No results found'}</p>
          <p className="text-xs text-gray-400 mt-1">Use "Add Received" or "Add Dispatch" above</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(d => {
              const sm = statusMeta(d.status, d.dispatch_type)
              const docLabel = DOCUMENT_TYPES.find(t => t.value === d.document_type)?.label ?? d.document_type
              const isInbound = d.dispatch_type === 'inbound'
              const statuses = isInbound ? INBOUND_STATUSES : OUTBOUND_STATUSES
              return (
                <div key={d.id} className={`bg-white border rounded-xl p-4 space-y-3 ${isInbound ? 'border-teal-200' : 'border-blue-200'}`}>
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${isInbound ? 'bg-teal-50 text-teal-600' : 'bg-blue-50 text-blue-600'}`}>
                      {isInbound ? <ArrowDownToLine className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] font-bold uppercase tracking-wide ${isInbound ? 'text-teal-600' : 'text-blue-600'}`}>
                        {isInbound ? 'Received' : 'Dispatched'}
                      </p>
                      <p className="font-semibold text-gray-900 leading-tight">{d.student_name}</p>
                      {d.enrollment_number && <p className="text-xs text-gray-400 font-mono">{d.enrollment_number}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${sm.color}`}>
                            {sm.label} <ChevronDown className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          {statuses.map(s => (
                            <DropdownMenuItem key={s.value} onClick={() => handleStatusChange(d.id, s.value, d.dispatch_type)}>
                              <div className={`w-2 h-2 rounded-full ${s.color.split(' ')[0]} mr-2`} />
                              <span className={d.status === s.value ? 'font-semibold' : ''}>{s.label}</span>
                              {d.status === s.value && <span className="ml-auto text-[10px] text-gray-400">✓</span>}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="text-[11px] bg-purple-50 text-purple-700 border border-purple-100 rounded-md px-2 py-0.5">{docLabel}</span>
                    {d.courier && <span className="text-[11px] bg-gray-50 text-gray-600 border border-gray-200 rounded-md px-2 py-0.5">{d.courier}</span>}
                    {d.associate && (
                      <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 rounded-md px-2 py-0.5">{d.associate.name}</span>
                    )}
                  </div>

                  {d.tracking_number && (
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                      <Package className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-mono text-xs font-semibold text-slate-700">{d.tracking_number}</span>
                    </div>
                  )}

                  <div className="flex gap-4 text-xs text-gray-500">
                    {d.dispatch_date && (
                      <div>
                        <p className="text-[10px] text-gray-400">{isInbound ? 'Received On' : 'Dispatched On'}</p>
                        <p className="font-medium text-gray-700">{format(new Date(d.dispatch_date + 'T00:00:00'), 'dd MMM yyyy')}</p>
                      </div>
                    )}
                    {d.expected_delivery && (
                      <div>
                        <p className="text-[10px] text-gray-400">Expected</p>
                        <p className="font-medium text-gray-700">{format(new Date(d.expected_delivery + 'T00:00:00'), 'dd MMM yyyy')}</p>
                      </div>
                    )}
                  </div>

                  {d.remarks && <p className="text-xs text-gray-400 italic">{d.remarks}</p>}
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Student</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Document</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Associate</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Courier / Tracking</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(d => {
                    const sm = statusMeta(d.status, d.dispatch_type)
                    const docLabel = DOCUMENT_TYPES.find(t => t.value === d.document_type)?.label ?? d.document_type
                    const isInbound = d.dispatch_type === 'inbound'
                    const statuses = isInbound ? INBOUND_STATUSES : OUTBOUND_STATUSES
                    return (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${isInbound ? 'bg-teal-50 text-teal-700' : 'bg-blue-50 text-blue-700'}`}>
                            {isInbound ? <ArrowDownToLine className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                            {isInbound ? 'Received' : 'Dispatched'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{d.student_name}</p>
                          {d.enrollment_number && <p className="text-[11px] text-gray-400 font-mono">{d.enrollment_number}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-purple-50 text-purple-700 border border-purple-100 rounded-md px-2 py-0.5">{docLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {d.associate
                            ? <><p className="font-medium text-gray-700">{d.associate.name}</p><p className="font-mono text-gray-400">{d.associate.associate_code}</p></>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {d.courier && <p className="text-xs text-gray-600">{d.courier}</p>}
                          {d.tracking_number && <p className="text-xs font-mono font-semibold text-blue-700">{d.tracking_number}</p>}
                          {!d.courier && !d.tracking_number && <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {d.dispatch_date ? format(new Date(d.dispatch_date + 'T00:00:00'), 'dd MMM yyyy') : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border hover:opacity-80 ${sm.color}`}>
                                {sm.label} <ChevronDown className="w-3 h-3 opacity-60" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="w-40">
                              {statuses.map(s => (
                                <DropdownMenuItem key={s.value} onClick={() => handleStatusChange(d.id, s.value, d.dispatch_type)}>
                                  <div className={`w-2 h-2 rounded-full ${s.color.split(' ')[0]} mr-2`} />
                                  <span className={d.status === s.value ? 'font-semibold' : ''}>{s.label}</span>
                                  {d.status === s.value && <span className="ml-auto text-[10px] text-gray-400">✓</span>}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(d)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(d.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-500">{filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}</div>
          </div>
        </>
      )}

      {/* ── Form Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {form.dispatch_type === 'inbound'
                ? <><ArrowDownToLine className="w-5 h-5 text-teal-600" /> {editItem ? 'Edit Received Entry' : 'Add Received Document'}</>
                : <><Send className="w-5 h-5 text-blue-600" /> {editItem ? 'Edit Dispatch Entry' : 'Add Dispatch'}</>
              }
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Type toggle — only on new entry */}
            {!editItem && (
              <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => setForm(p => ({ ...p, dispatch_type: 'inbound', status: 'pending' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${form.dispatch_type === 'inbound' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" /> Received
                </button>
                <button
                  onClick={() => setForm(p => ({ ...p, dispatch_type: 'outbound', status: 'pending' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${form.dispatch_type === 'outbound' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Send className="w-3.5 h-3.5" /> Dispatch
                </button>
              </div>
            )}

            {/* ── Student picker ── */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">Student *</Label>
                {!editItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setManualEntry(v => !v)
                      setForm(p => ({ ...p, student_id: '', student_name: '', enrollment_number: '', associate_id: '' }))
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {manualEntry ? 'Search from students' : 'Enter manually'}
                  </button>
                )}
              </div>

              {editItem ? (
                <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900">{form.student_name}</p>
                  {form.enrollment_number && <p className="text-xs text-gray-400 font-mono">{form.enrollment_number}</p>}
                </div>
              ) : manualEntry ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Student full name *"
                    value={form.student_name}
                    onChange={e => setForm(p => ({ ...p, student_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Enrollment number (optional)"
                    value={form.enrollment_number}
                    onChange={e => setForm(p => ({ ...p, enrollment_number: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <StudentCombobox
                  students={students}
                  value={form.student_id}
                  onChange={handleStudentSelect}
                />
              )}
            </div>

            {/* Associate — auto-filled, but can override */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Associate</Label>
              <select
                value={form.associate_id}
                onChange={e => setForm(p => ({ ...p, associate_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None / Direct</option>
                {associates.map(a => <option key={a.id} value={a.id}>{a.name} {a.associate_code ? `(${a.associate_code})` : ''}</option>)}
              </select>
              {form.associate_id && !editItem && (
                <p className="text-[11px] text-teal-600 mt-0.5">Auto-filled from student's referral</p>
              )}
            </div>

            {/* Document type + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Document *</Label>
                <select
                  value={form.document_type}
                  onChange={e => setForm(p => ({ ...p, document_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Status</Label>
                <select
                  value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(form.dispatch_type === 'inbound' ? INBOUND_STATUSES : OUTBOUND_STATUSES).map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                {form.dispatch_type === 'inbound' ? 'Received Date' : 'Dispatch Date'}
              </Label>
              <input
                type="date"
                value={form.dispatch_date}
                onChange={e => setForm(p => ({ ...p, dispatch_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Optional fields toggle */}
            <button
              type="button"
              onClick={() => setShowOptional(v => !v)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showOptional ? 'rotate-90' : ''}`} />
              {showOptional ? 'Hide' : 'Add'} courier, tracking & remarks
            </button>

            {showOptional && (
              <div className="space-y-3 pt-1 border-t border-dashed border-gray-200">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Courier</Label>
                    <select
                      value={form.courier}
                      onChange={e => setForm(p => ({ ...p, courier: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select…</option>
                      {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Tracking No.</Label>
                    <input
                      type="text"
                      placeholder="EE123456IN"
                      value={form.tracking_number}
                      onChange={e => setForm(p => ({ ...p, tracking_number: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Expected Delivery</Label>
                  <input
                    type="date"
                    value={form.expected_delivery}
                    onChange={e => setForm(p => ({ ...p, expected_delivery: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Remarks</Label>
                  <input
                    type="text"
                    placeholder="Any notes…"
                    value={form.remarks}
                    onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={saving || (!editItem && !form.student_name)}
                className={`min-w-24 ${form.dispatch_type === 'inbound' ? 'bg-teal-600 hover:bg-teal-700' : ''}`}
              >
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : editItem ? 'Update' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

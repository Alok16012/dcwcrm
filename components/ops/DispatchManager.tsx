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
  Package, X, ArrowDownToLine, Send, ChevronRight, Plus, Printer, MessageCircle,
} from 'lucide-react'
import { format } from 'date-fns'

// ── Constants ────────────────────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  { value: 'marksheet',                label: 'Marksheet' },
  { value: 'migration',                label: 'Migration' },
  { value: 'transfer_certificate',     label: 'Transfer Certificate' },
  { value: 'duplicate_marksheet',      label: 'Duplicate Marksheet' },
  { value: 'consolidated_marksheet',   label: 'Consolidated Marksheet' },
  { value: 'verification_certificate', label: 'Verification Certificate' },
  { value: 'transcript',               label: 'Transcript' },
  { value: 'slc_clc',                  label: 'SLC / CLC' },
  { value: 'degree_certificate',       label: 'Degree / Certificate' },
  { value: 'id_card',                  label: 'ID Card' },
  { value: 'admit_card',               label: 'Admit Card' },
  { value: 'enrollment_letter',        label: 'Enrollment Letter' },
]

// Legacy values kept only for displaying older records correctly
const LEGACY_DOC_LABELS: Record<string, string> = {
  certificate: 'Certificate', degree: 'Degree / Diploma', other: 'Other',
}
const docLabelOf = (v: string) =>
  DOCUMENT_TYPES.find(t => t.value === v)?.label ?? LEGACY_DOC_LABELS[v] ?? v

const newDocRow = (): DocRow => ({ document_type: 'migration', status: 'pending', remarks: '' })

const RECEIVER_RELATIONS = ['Father', 'Mother', 'Brother', 'Sister', 'Uncle', 'Aunt', 'Guardian', 'Friend', 'Other']

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
  father_name: string | null
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
  student_phone: string | null
  father_name: string | null
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
  received_by: string | null
  receiver_name: string | null
  receiver_relation: string | null
  receiver_phone: string | null
  created_at: string
}

interface DocRow { id?: string; document_type: string; status: string; remarks: string }

// One dispatch entry can span several rows (one per document); group them so a
// student's marksheet + migration etc. show as a single record.
const groupKeyOf = (d: Dispatch) => [
  d.dispatch_type, d.student_name.trim().toLowerCase(), d.enrollment_number ?? '',
  d.dispatch_date ?? '', d.tracking_number ?? '', d.courier ?? '',
].join('|')

interface DispatchGroup { key: string; head: Dispatch; rows: Dispatch[] }

function groupDispatches(list: Dispatch[]): DispatchGroup[] {
  const map = new Map<string, DispatchGroup>()
  for (const d of list) {
    const key = groupKeyOf(d)
    const g = map.get(key)
    if (g) g.rows.push(d)
    else map.set(key, { key, head: d, rows: [d] })
  }
  return Array.from(map.values())
}

const EMPTY_FORM = {
  dispatch_type: 'outbound' as 'inbound' | 'outbound',
  student_id: '',
  student_name: '',
  student_phone: '',
  father_name: '',
  enrollment_number: '',
  associate_id: '',
  courier: '',
  tracking_number: '',
  dispatch_date: '',
  expected_delivery: '',
  received_by: '',       // '' (courier) | 'self' | 'guardian'
  receiver_name: '',
  receiver_relation: '',
  receiver_phone: '',
  documents: [newDocRow()] as DocRow[],
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
  const [editRows, setEditRows] = useState<Dispatch[]>([])
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
      .select('id, full_name, enrollment_number, phone, father_name, lead_id, leads(referred_by_associate, associates:referred_by_associate(id, name, associate_code))')
      .order('full_name')

    const mapped: StudentOption[] = (studs ?? []).map((s: any) => ({
      id: s.id,
      full_name: s.full_name,
      enrollment_number: s.enrollment_number ?? '',
      phone: s.phone ?? '',
      father_name: s.father_name ?? null,
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
    setEditRows([])
    setForm({ ...EMPTY_FORM, dispatch_type: type })
    setManualEntry(false)
    setShowOptional(false)
    setFormOpen(true)
  }

  function openEdit(g: DispatchGroup) {
    const d = g.head
    setEditItem(d)
    setEditRows(g.rows)
    setForm({
      dispatch_type: d.dispatch_type,
      student_id: '',
      student_name: d.student_name,
      student_phone: d.student_phone ?? '',
      father_name: d.father_name ?? '',
      enrollment_number: d.enrollment_number ?? '',
      associate_id: d.associate_id ?? '',
      courier: d.courier ?? '',
      tracking_number: d.tracking_number ?? '',
      dispatch_date: d.dispatch_date ?? '',
      expected_delivery: d.expected_delivery ?? '',
      received_by: d.received_by ?? '',
      receiver_name: d.receiver_name ?? '',
      receiver_relation: d.receiver_relation ?? '',
      receiver_phone: d.receiver_phone ?? '',
      documents: g.rows.map(r => ({ id: r.id, document_type: r.document_type, status: r.status, remarks: r.remarks ?? '' })),
    })
    setShowOptional(!!(d.courier || d.tracking_number || d.expected_delivery))
    setFormOpen(true)
  }

  function handleStudentSelect(s: StudentOption | null) {
    if (!s) {
      setForm(p => ({ ...p, student_id: '', student_name: '', student_phone: '', father_name: '', enrollment_number: '', associate_id: '' }))
      return
    }
    setForm(p => ({
      ...p,
      student_id: s.id,
      student_name: s.full_name,
      student_phone: s.phone,
      father_name: s.father_name ?? '',
      enrollment_number: s.enrollment_number,
      associate_id: s.associate_id ?? p.associate_id,
    }))
  }

  async function handleSave() {
    if (!form.student_name.trim()) { toast.error('Student name is required'); return }
    if (!form.student_phone.trim()) { toast.error('Phone number is required'); return }
    if (!form.father_name.trim()) { toast.error("Father's name is required"); return }
    const docs = form.documents.filter(d => d.document_type)
    if (docs.length === 0) { toast.error('Add at least one document'); return }
    if (form.received_by === 'guardian' && (!form.receiver_name.trim() || !form.receiver_relation)) {
      toast.error('Receiver name and relation are required for guardian/relative')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    // Fields shared across every document row in this entry
    const isPickup = form.received_by === 'self' || form.received_by === 'guardian'
    const base = {
      dispatch_type: form.dispatch_type,
      student_name: form.student_name.trim(),
      student_phone: form.student_phone.trim() || null,
      father_name: form.father_name.trim() || null,
      enrollment_number: form.enrollment_number.trim() || null,
      associate_id: form.associate_id || null,
      courier: form.courier || null,
      tracking_number: form.tracking_number.trim() || null,
      dispatch_date: form.dispatch_date || null,
      expected_delivery: form.expected_delivery || null,
      received_by: form.received_by || null,
      receiver_name: isPickup ? form.receiver_name.trim() || null : null,
      receiver_relation: form.received_by === 'guardian' ? form.receiver_relation || null : null,
      receiver_phone: isPickup ? form.receiver_phone.trim() || null : null,
      dispatched_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    }
    // If the DB hasn't got the newer columns yet, drop them and retry once so
    // saving still works before the migration is applied.
    const stripNewCols = (obj: any) => {
      const { father_name, received_by, receiver_name, receiver_relation, receiver_phone, ...rest } = obj
      return rest
    }
    const isMissingColErr = (e: any) => /father_name|received_by|receiver_/.test(e?.message ?? '') && /column|schema/.test(e?.message ?? '')
    try {
      if (editItem) {
        // Grouped edit: update kept docs, insert new ones, delete removed ones.
        const keptIds = docs.filter(d => d.id).map(d => d.id as string)
        const removedIds = editRows.map(r => r.id).filter(id => !keptIds.includes(id))
        for (const d of docs) {
          const row = { ...base, document_type: d.document_type, status: d.status, remarks: d.remarks.trim() || null }
          let { error } = d.id
            ? await db.from('student_dispatches').update(row).eq('id', d.id)
            : await db.from('student_dispatches').insert(row)
          if (error && isMissingColErr(error)) {
            ({ error } = d.id
              ? await db.from('student_dispatches').update(stripNewCols(row)).eq('id', d.id)
              : await db.from('student_dispatches').insert(stripNewCols(row)))
          }
          if (error) { toast.error(error.message); return }
        }
        if (removedIds.length) {
          const { error } = await db.from('student_dispatches').delete().in('id', removedIds)
          if (error) { toast.error(error.message); return }
        }
        toast.success('Updated')
      } else {
        // one row per document, all sharing the same student / courier / date
        const rows = docs.map(d => ({ ...base, document_type: d.document_type, status: d.status, remarks: d.remarks.trim() || null }))
        let { error } = await db.from('student_dispatches').insert(rows)
        if (error && isMissingColErr(error)) ({ error } = await db.from('student_dispatches').insert(rows.map(stripNewCols)))
        if (error) { toast.error(error.message); return }
        toast.success(`${form.dispatch_type === 'inbound' ? 'Receive' : 'Dispatch'} entry added (${rows.length} document${rows.length > 1 ? 's' : ''})`)
      }
      setFormOpen(false)
      load()
    } finally { setSaving(false) }
  }

  async function handleStatusChange(ids: string[], newStatus: string) {
    const { error } = await db.from('student_dispatches').update({ status: newStatus, updated_at: new Date().toISOString() }).in('id', ids)
    if (error) { toast.error('Failed to update'); return }
    toast.success('Status updated')
    setDispatches(prev => prev.map(d => ids.includes(d.id) ? { ...d, status: newStatus } : d))
  }

  async function handleDelete(g: DispatchGroup) {
    const ids = g.rows.map(r => r.id)
    if (!confirm(`Delete this entry (${ids.length} document${ids.length > 1 ? 's' : ''})?`)) return
    const { error } = await db.from('student_dispatches').delete().in('id', ids)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Deleted')
    setDispatches(prev => prev.filter(d => !ids.includes(d.id)))
  }

  // WhatsApp the student the dispatch/receive details right away
  function sendDetails(g: DispatchGroup) {
    const d = g.head
    let digits = (d.student_phone ?? '').replace(/\D/g, '')
    if (digits.length === 10) digits = '91' + digits
    else if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1)
    if (digits.length < 11) { toast.error('Student ka valid phone number nahi hai'); return }

    const isInbound = d.dispatch_type === 'inbound'
    const fmtDate = (v: string | null) => v ? format(new Date(v + 'T00:00:00'), 'dd MMM yyyy') : null
    const docList = g.rows.map(r => `- ${docLabelOf(r.document_type)}`).join('\n')
    const lines: string[] = []
    lines.push(`Dear ${d.student_name},`)
    lines.push('')
    lines.push(isInbound
      ? 'We have received your following document(s) at Distance Courses Wala:'
      : 'Your following document(s) have been dispatched from Distance Courses Wala:')
    lines.push(docList)
    lines.push('')
    if (d.received_by === 'self') lines.push('Handed over to: Self (collected from office)')
    if (d.received_by === 'guardian') lines.push(`Handed over to: ${d.receiver_name ?? 'Guardian'}${d.receiver_relation ? ` (${d.receiver_relation})` : ''}${d.receiver_phone ? `, ${d.receiver_phone}` : ''}`)
    if (d.courier) lines.push(`Courier: ${d.courier}`)
    if (d.tracking_number) lines.push(`Tracking No: ${d.tracking_number}`)
    const dd = fmtDate(d.dispatch_date)
    if (dd) lines.push(`${isInbound ? 'Received' : 'Dispatch'} Date: ${dd}`)
    const ed = fmtDate(d.expected_delivery)
    if (ed) lines.push(`Expected Delivery: ${ed}`)
    lines.push('')
    lines.push('- Team Distance Courses Wala')

    const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  // Build a printable receipt for the student covering every document in the group.
  function downloadReceipt(g: DispatchGroup) {
    const d = g.head
    const isInbound = d.dispatch_type === 'inbound'
    const docs = g.rows
    const fmtDate = (v: string | null) => v ? format(new Date(v + 'T00:00:00'), 'dd MMM yyyy') : '—'
    const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
    const receiptNo = `DCW-${(isInbound ? 'R' : 'D')}${(d.created_at ? new Date(d.created_at).getTime() : Date.now()).toString().slice(-8)}`
    const rows = docs.map((x, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${esc(docLabelOf(x.document_type))}</td>
        <td>${esc(statusMeta(x.status, x.dispatch_type).label)}</td>
        <td>${esc(x.remarks ?? '—')}</td>
      </tr>`).join('')
    const receiverMeta = d.received_by === 'self'
      ? `<div><label>Handed Over To</label>Self (student)</div>`
      : d.received_by === 'guardian'
        ? `<div><label>Handed Over To</label>${esc(d.receiver_name ?? 'Guardian')}${d.receiver_relation ? ` (${esc(d.receiver_relation)})` : ''}</div>` +
          (d.receiver_phone ? `<div><label>Receiver Phone</label>${esc(d.receiver_phone)}</div>` : '')
        : ''
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${receiptNo}</title>
    <style>
      *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{margin:0;padding:32px;color:#1e293b}
      .wrap{max-width:720px;margin:0 auto;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}
      .head{padding:22px 26px;border-bottom:3px solid #2563eb}
      .head h1{margin:0;font-size:24px;letter-spacing:.3px;color:#2563eb}
      .head p{margin:4px 0 0;font-size:12px;color:#64748b}
      .body{padding:24px 26px}
      .title{font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#2563eb;margin:0 0 14px}
      .meta{display:flex;flex-wrap:wrap;gap:14px 28px;margin-bottom:18px}
      .meta div{font-size:13px}
      .meta label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:2px}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border:1px solid #e2e8f0;padding:8px 10px;font-size:13px;text-align:left}
      th{background:#eff6ff;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#2563eb}
      .sign{display:flex;justify-content:space-between;margin-top:42px;font-size:12px;color:#64748b}
      .foot{text-align:center;font-size:11px;color:#94a3b8;padding:14px;border-top:1px dashed #e2e8f0}
    </style></head><body>
      <div class="wrap">
        <div class="head"><h1>Distance Courses Wala</h1><p>Document ${isInbound ? 'Received Acknowledgement' : 'Dispatch Receipt'}</p></div>
        <div class="body">
          <p class="title">${isInbound ? 'Received Acknowledgement' : 'Dispatch Receipt'}</p>
          <div class="meta">
            <div><label>Receipt No.</label>${receiptNo}</div>
            <div><label>${isInbound ? 'Received Date' : 'Dispatch Date'}</label>${fmtDate(d.dispatch_date)}</div>
            <div><label>Student</label>${esc(d.student_name)}</div>
            ${d.father_name ? `<div><label>Father's Name</label>${esc(d.father_name)}</div>` : ''}
            ${d.enrollment_number ? `<div><label>Enrollment No.</label>${esc(d.enrollment_number)}</div>` : ''}
            ${d.student_phone ? `<div><label>Phone</label>${esc(d.student_phone)}</div>` : ''}
            ${receiverMeta}
            ${d.courier ? `<div><label>Courier</label>${esc(d.courier)}</div>` : ''}
            ${d.tracking_number ? `<div><label>Tracking No.</label>${esc(d.tracking_number)}</div>` : ''}
          </div>
          <table>
            <thead><tr><th style="width:42px;text-align:center">#</th><th>Document</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="sign"><span>Receiver's Signature</span><span>Authorised Signatory</span></div>
        </div>
        <div class="foot">This is a system-generated receipt from Distance Courses Wala · crmrahul.vercel.app</div>
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
    </body></html>`
    const w = window.open('', '_blank')
    if (!w) { toast.error('Allow pop-ups to download the receipt'); return }
    w.document.write(html)
    w.document.close()
  }

  // One entry (group) per student dispatch — a group can hold several documents
  const allGroups = groupDispatches(dispatches)
  const tabGroups = allGroups.filter(g => activeTab === 'all' || g.head.dispatch_type === activeTab)
  const groups = tabGroups.filter(g => {
    const d = g.head
    const q = search.toLowerCase()
    const matchSearch = !q || d.student_name.toLowerCase().includes(q) || (d.enrollment_number ?? '').toLowerCase().includes(q) || (d.tracking_number ?? '').toLowerCase().includes(q) || (d.associate?.name ?? '').toLowerCase().includes(q)
    const matchStatus = !filterStatus || g.rows.some(r => r.status === filterStatus)
    const matchAssoc = !filterAssociate || d.associate_id === filterAssociate
    return matchSearch && matchStatus && matchAssoc
  })

  const inboundCount  = allGroups.filter(g => g.head.dispatch_type === 'inbound').length
  const outboundCount = allGroups.filter(g => g.head.dispatch_type === 'outbound').length
  const currentStatuses = activeTab === 'inbound' ? INBOUND_STATUSES : activeTab === 'outbound' ? OUTBOUND_STATUSES : [...new Map([...INBOUND_STATUSES, ...OUTBOUND_STATUSES].map(s => [s.value, s])).values()]

  // Student selected in form
  const formStudentObj = students.find(s => s.id === form.student_id) ?? null

  const pendingCount = allGroups.filter(g => g.rows.some(r => r.status === 'pending')).length

  return (
    <div className="space-y-4">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-5 sm:p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center"><Truck className="w-5 h-5" /></div>
              <h1 className="text-xl font-bold tracking-tight">Dispatch &amp; Documents</h1>
            </div>
            <p className="text-blue-100 text-sm">Track received &amp; dispatched student documents</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => openAdd('inbound')} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors px-3.5 py-2 rounded-lg text-sm font-semibold backdrop-blur-sm">
              <ArrowDownToLine className="w-4 h-4" /> <span className="hidden sm:inline">Add</span> Received
            </button>
            <button onClick={() => openAdd('outbound')} className="inline-flex items-center gap-1.5 bg-white text-blue-700 hover:bg-blue-50 transition-colors px-3.5 py-2 rounded-lg text-sm font-bold shadow-sm">
              <Send className="w-4 h-4" /> <span className="hidden sm:inline">Add</span> Dispatch
            </button>
          </div>
        </div>
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { icon: Package, label: 'Total Entries', value: allGroups.length },
            { icon: ArrowDownToLine, label: 'Received', value: inboundCount },
            { icon: Send, label: 'Dispatched', value: outboundCount },
            { icon: RefreshCw, label: 'Pending', value: pendingCount },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-blue-100 text-[11px] font-semibold uppercase tracking-wide">
                <s.icon className="w-3.5 h-3.5" /> {s.label}
              </div>
              <p className="text-2xl font-extrabold mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Type Tabs ── */}
      <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        {([
          { key: 'all',      label: `All (${allGroups.length})` },
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
          const count = tabGroups.filter(g => g.rows.some(r => r.status === s.value)).length
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

        <Button variant="outline" size="sm" onClick={load} className="h-9 px-2.5 gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {(search || filterStatus || filterAssociate) && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{groups.length} result{groups.length !== 1 ? 's' : ''}</span>
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
      ) : groups.length === 0 ? (
        <div className="text-center py-16 border rounded-xl bg-white">
          <Truck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">{dispatches.length === 0 ? 'No entries yet' : 'No results found'}</p>
          <p className="text-xs text-gray-400 mt-1">Use "Add Received" or "Add Dispatch" above</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {groups.map(g => {
              const d = g.head
              const ids = g.rows.map(r => r.id)
              const sm = statusMeta(d.status, d.dispatch_type)
              const isInbound = d.dispatch_type === 'inbound'
              const statuses = isInbound ? INBOUND_STATUSES : OUTBOUND_STATUSES
              return (
                <div key={g.key} className={`bg-white border rounded-xl p-4 space-y-3 ${isInbound ? 'border-teal-200' : 'border-blue-200'}`}>
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
                            <DropdownMenuItem key={s.value} onClick={() => handleStatusChange(ids, s.value)}>
                              <div className={`w-2 h-2 rounded-full ${s.color.split(' ')[0]} mr-2`} />
                              <span className={d.status === s.value ? 'font-semibold' : ''}>{s.label}</span>
                              {d.status === s.value && <span className="ml-auto text-[10px] text-gray-400">✓</span>}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <button onClick={() => sendDetails(g)} title="Send details on WhatsApp" className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50">
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => downloadReceipt(g)} title="Download receipt" className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(g)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {g.rows.map(r => (
                      <span key={r.id} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 rounded-md px-2 py-0.5">{docLabelOf(r.document_type)}</span>
                    ))}
                    {d.received_by && (
                      <span className="text-[11px] bg-violet-50 text-violet-700 border border-violet-100 rounded-md px-2 py-0.5">
                        {d.received_by === 'self' ? 'Self pickup' : `${d.receiver_name ?? 'Guardian'}${d.receiver_relation ? ` (${d.receiver_relation})` : ''}`}
                      </span>
                    )}
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
                  {groups.map(g => {
                    const d = g.head
                    const ids = g.rows.map(r => r.id)
                    const sm = statusMeta(d.status, d.dispatch_type)
                    const isInbound = d.dispatch_type === 'inbound'
                    const statuses = isInbound ? INBOUND_STATUSES : OUTBOUND_STATUSES
                    return (
                      <tr key={g.key} className="hover:bg-slate-50 transition-colors">
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
                          <div className="flex flex-wrap gap-1">
                            {g.rows.map(r => (
                              <span key={r.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-md px-2 py-0.5">{docLabelOf(r.document_type)}</span>
                            ))}
                          </div>
                          {d.received_by && (
                            <p className="text-[11px] text-violet-600 mt-1">
                              {d.received_by === 'self' ? 'Self pickup' : `${d.receiver_name ?? 'Guardian'}${d.receiver_relation ? ` (${d.receiver_relation})` : ''}`}
                            </p>
                          )}
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
                                <DropdownMenuItem key={s.value} onClick={() => handleStatusChange(ids, s.value)}>
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
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" title="Send details on WhatsApp" onClick={() => sendDetails(g)}><MessageCircle className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50" title="Download receipt" onClick={() => downloadReceipt(g)}><Printer className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(g)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(g)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-500">{groups.length} entr{groups.length !== 1 ? 'ies' : 'y'}</div>
          </div>
        </>
      )}

      {/* ── Form Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${form.dispatch_type === 'inbound' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
                {form.dispatch_type === 'inbound' ? <ArrowDownToLine className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              </span>
              <span className="flex flex-col">
                <span className="text-base font-bold leading-tight">
                  {form.dispatch_type === 'inbound'
                    ? (editItem ? 'Edit Received Entry' : 'Add Received Document')
                    : (editItem ? 'Edit Dispatch Entry' : 'Add Dispatch')}
                </span>
                <span className="text-xs font-normal text-gray-400">Fill student & document details below</span>
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Type toggle — only on new entry */}
            {!editItem && (
              <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => setForm(p => ({ ...p, dispatch_type: 'inbound', documents: p.documents.map(d => ({ ...d, status: 'pending' })) }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${form.dispatch_type === 'inbound' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" /> Received
                </button>
                <button
                  onClick={() => setForm(p => ({ ...p, dispatch_type: 'outbound', documents: p.documents.map(d => ({ ...d, status: 'pending' })) }))}
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
                <div className="space-y-2">
                  <input type="text" value={form.student_name} onChange={e => setForm(p => ({ ...p, student_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="tel" value={form.student_phone} onChange={e => setForm(p => ({ ...p, student_phone: e.target.value }))}
                      placeholder="Phone *" className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="text" value={form.father_name} onChange={e => setForm(p => ({ ...p, father_name: e.target.value }))}
                      placeholder="Father's name *" className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <input type="text" value={form.enrollment_number} onChange={e => setForm(p => ({ ...p, enrollment_number: e.target.value }))}
                    placeholder="Enrollment number" className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ) : manualEntry ? (
                <div className="space-y-2">
                  <input type="text" placeholder="Student full name *" value={form.student_name}
                    onChange={e => setForm(p => ({ ...p, student_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="tel" placeholder="Phone number *" value={form.student_phone}
                      onChange={e => setForm(p => ({ ...p, student_phone: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="Father's name *" value={form.father_name}
                      onChange={e => setForm(p => ({ ...p, father_name: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <input type="text" placeholder="Enrollment number (optional)" value={form.enrollment_number}
                    onChange={e => setForm(p => ({ ...p, enrollment_number: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ) : (
                <>
                  <StudentCombobox students={students} value={form.student_id} onChange={handleStudentSelect} />
                  {/* Show filled details after student is selected */}
                  {form.student_id && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Phone *</p>
                        <input type="tel" value={form.student_phone}
                          onChange={e => setForm(p => ({ ...p, student_phone: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Father's Name *</p>
                        <input type="text" value={form.father_name}
                          onChange={e => setForm(p => ({ ...p, father_name: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  )}
                </>
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

            {/* Documents — one or more, each with its own status & remarks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">Documents *</Label>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, documents: [...p.documents, { ...newDocRow(), status: p.documents[0]?.status ?? 'pending' }] }))}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <Plus className="w-3.5 h-3.5" /> Add document
                </button>
              </div>
              {form.documents.map((doc, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 bg-slate-50/60 p-2.5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase">Document</Label>
                      <select
                        value={doc.document_type}
                        onChange={e => setForm(p => ({ ...p, documents: p.documents.map((d, i) => i === idx ? { ...d, document_type: e.target.value } : d) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase">Status</Label>
                      <select
                        value={doc.status}
                        onChange={e => setForm(p => ({ ...p, documents: p.documents.map((d, i) => i === idx ? { ...d, status: e.target.value } : d) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {(form.dispatch_type === 'inbound' ? INBOUND_STATUSES : OUTBOUND_STATUSES).map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-slate-500 uppercase">Remarks / Details</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Enter details for this document…"
                        value={doc.remarks}
                        onChange={e => setForm(p => ({ ...p, documents: p.documents.map((d, i) => i === idx ? { ...d, remarks: e.target.value } : d) }))}
                        className="flex-1 border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {form.documents.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setForm(p => ({ ...p, documents: p.documents.filter((_, i) => i !== idx) }))}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                          title="Remove document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Handover — courier, or collected from office by self / guardian */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                {form.dispatch_type === 'inbound' ? 'Submitted By' : 'Handover To'}
              </Label>
              <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
                {([
                  { value: '',         label: 'Courier / Post' },
                  { value: 'self',     label: 'Self' },
                  { value: 'guardian', label: 'Guardian / Relative' },
                ] as const).map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setForm(p => ({
                      ...p,
                      received_by: o.value,
                      receiver_name: o.value === 'self' ? p.student_name : o.value === 'guardian' ? p.receiver_name : '',
                      receiver_relation: o.value === 'guardian' ? p.receiver_relation : '',
                      receiver_phone: o.value === 'self' ? p.student_phone : o.value === 'guardian' ? p.receiver_phone : '',
                    }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${form.received_by === o.value ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {(form.received_by === 'self' || form.received_by === 'guardian') && (
                <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-2.5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase">
                        {form.received_by === 'self' ? 'Student Name' : 'Receiver Name *'}
                      </Label>
                      <input type="text" value={form.receiver_name}
                        onChange={e => setForm(p => ({ ...p, receiver_name: e.target.value }))}
                        placeholder="Full name"
                        className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase">Phone</Label>
                      <input type="tel" value={form.receiver_phone}
                        onChange={e => setForm(p => ({ ...p, receiver_phone: e.target.value }))}
                        placeholder="Phone number"
                        className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  {form.received_by === 'guardian' && (
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase">Relation *</Label>
                      <select
                        value={form.receiver_relation}
                        onChange={e => setForm(p => ({ ...p, receiver_relation: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select relation…</option>
                        {RECEIVER_RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
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
              {showOptional ? 'Hide' : 'Add'} courier & tracking
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
              </div>
            )}

            <div className="flex gap-3 justify-end pt-3 mt-1 border-t border-gray-100 sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.student_name || !form.student_phone || !form.father_name}
                className={`min-w-28 gap-1.5 ${form.dispatch_type === 'inbound' ? 'bg-teal-600 hover:bg-teal-700' : ''}`}
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <>{form.dispatch_type === 'inbound' ? <ArrowDownToLine className="w-4 h-4" /> : <Send className="w-4 h-4" />} {editItem ? 'Update' : 'Save'}</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

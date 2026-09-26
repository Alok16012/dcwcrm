'use client'
import { withBase } from '@/lib/base-path'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  UserPlus, Users, CheckCircle2, Clock, XCircle,
  ChevronLeft, ChevronRight, Eye, RefreshCw, KeyRound, Copy, Pencil, Trash2, Search, UserCog, Download,
  Upload, FileCheck2, X, FileText,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CreateAssociateDialog, PhotoUpload } from '@/components/associates/CreateAssociateDialog'
import { Textarea } from '@/components/ui/textarea'

type AssociateStatus = 'pending' | 'approved' | 'rejected'

const PAGE_SIZES = [10, 20, 50, 100]

// Working status of an approved associate (associates.activity_status, migration 103)
type ActivityStatus = 'active' | 'inactive' | 'hold'
const ACTIVITY_LABELS: Record<ActivityStatus, string> = { active: 'Active', inactive: 'Non Active', hold: 'Hold' }
const ACTIVITY_STYLES: Record<ActivityStatus, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  hold: 'bg-amber-50 text-amber-700 border-amber-200',
}
const EMPTY_STATS = { admissions: 0, active: 0, revenue: 0, received: 0 }
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`

const DOC_KEYS = ['aadhar', 'pan', 'cheque'] as const
type DocKey = typeof DOC_KEYS[number]
const DOC_LABELS: Record<DocKey, string> = { aadhar: 'Aadhaar Card', pan: 'PAN Card', cheque: 'Cancelled Cheque' }
const EMPTY_EDIT_DOCS: Record<DocKey, File | null> = { aadhar: null, pan: null, cheque: null }

/** Display-only: a bare 10-digit number gets the +91 country code; anything else is shown as stored. */
const fmtPhone = (raw: string | null | undefined) => {
  if (!raw) return '—'
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+91 ${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2)}`
  return raw
}

interface Associate {
  id: string
  name: string
  phone: string
  father_phone: string | null
  father_name: string | null
  email: string
  aadhar_number: string | null
  pan_number: string | null
  aadhar_doc_url: string | null
  pan_doc_url: string | null
  cheque_doc_url: string | null
  state: string | null
  district: string | null
  city: string | null
  institution_name: string | null
  institution_address: string | null
  pincode: string | null
  photo_url: string | null
  current_address: string | null
  current_city: string | null
  current_state: string | null
  current_pincode: string | null
  permanent_address: string | null
  permanent_city: string | null
  permanent_state: string | null
  permanent_pincode: string | null
  same_as_current: boolean
  bank_name: string | null
  account_number: string | null
  ifsc_code: string | null
  account_holder_name: string | null
  status: AssociateStatus
  associate_code: string | null
  wallet_balance: number
  coordinator_id: string | null
  coordinator_name: string | null
  temp_password: string | null
  activity_status?: ActivityStatus | null
  created_at: string
}

// lockedStatus pins the list to one status (e.g. the "Approved" tab) and hides the status filter
export function AssociateManager({ lockedStatus }: { lockedStatus?: AssociateStatus } = {}) {
  const router = useRouter()
  const supabase = createClient()
  const db = supabase as any
  const [isAdmin, setIsAdmin] = useState(false)
  const [viewerId, setViewerId] = useState<string | null>(null)
  // Admin and backend run the whole associate network and see everyone.
  // Lead/counselor are "coordinators" — each associate is assigned to one via
  // coordinator_id, and a coordinator should only ever see their own, the
  // same way a counselor only sees their own leads.
  const [canSeeAllAssociates, setCanSeeAllAssociates] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [associates, setAssociates] = useState<Associate[]>([])
  const [aggStudents, setAggStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [coordFilter, setCoordFilter] = useState('all') // 'all' | coordinator name | 'unassigned'
  // Approved-tab performance filters
  const [filterActivity, setFilterActivity] = useState('')        // '' | active | inactive | hold
  const [filterAdmissions, setFilterAdmissions] = useState('')    // '' | none | 1 | 5 | 10
  const [filterActiveStudents, setFilterActiveStudents] = useState('') // '' | none | some
  const [filterRevenue, setFilterRevenue] = useState('')          // '' | none | 10000 | 50000 | 100000
  const [sortBy, setSortBy] = useState('')                        // '' | admissions | active | revenue
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState(20)
  // Page is remembered per filter combination, so changing any filter lands back on page 1
  const [pageState, setPageState] = useState({ key: '', page: 1 })
  const [credOpen, setCredOpen] = useState(false)
  const [credAssoc, setCredAssoc] = useState<Associate | null>(null)
  const [resettingPass, setResettingPass] = useState(false)

  // Edit state
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Associate | null>(null)
  const [editForm, setEditForm] = useState<Partial<Associate>>({})
  const [saving, setSaving] = useState(false)
  const [editPhoto, setEditPhoto] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null)
  const [editDocs, setEditDocs] = useState(EMPTY_EDIT_DOCS)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Associate | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setViewerId(user.id)
      const { data } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
      const role = (data as any)?.role
      if (role === 'admin') setIsAdmin(true)
      setCanSeeAllAssociates(role === 'admin' || role === 'backend')
    })
  }, [supabase])

  const load = useCallback(async () => {
    if (!viewerId) return
    setLoading(true)
    let assocQuery = db.from('associates').select('*').order('created_at', { ascending: false })
    if (!canSeeAllAssociates) assocQuery = assocQuery.eq('coordinator_id', viewerId)
    const [{ data }, { data: studs }] = await Promise.all([
      assocQuery,
      db.from('students')
        .select('id, total_fee, amount_paid, status, referred_by_associate, sub_section:department_sub_sections(name)')
        .not('referred_by_associate', 'is', null),
    ])
    setAssociates((data ?? []) as Associate[])
    setAggStudents((studs ?? []) as any[])
    setLoading(false)
  }, [db, viewerId, canSeeAllAssociates])

  // Waits on viewerId/canSeeAllAssociates so the first fetch is already
  // scoped — loading unscoped and re-fetching a moment later would flash
  // every associate's bank and ID details in front of a coordinator, if only
  // for a frame.
  useEffect(() => { if (viewerId !== null) load() }, [load, viewerId])

  function openEdit(a: Associate) {
    setEditTarget(a)
    setEditPhoto(null)
    setEditPhotoPreview(null)
    setEditDocs(EMPTY_EDIT_DOCS)
    setEditForm({
      name: a.name, phone: a.phone, father_name: a.father_name ?? a.father_phone ?? '',
      email: a.email, aadhar_number: a.aadhar_number ?? '', pan_number: a.pan_number ?? '',
      state: a.state ?? '', district: a.district ?? '', city: a.city ?? '',
      institution_name: a.institution_name ?? '', institution_address: a.institution_address ?? '',
      pincode: a.pincode ?? a.current_pincode ?? '', photo_url: a.photo_url,
      aadhar_doc_url: a.aadhar_doc_url, pan_doc_url: a.pan_doc_url, cheque_doc_url: a.cheque_doc_url,
      bank_name: a.bank_name ?? '', account_number: a.account_number ?? '',
      ifsc_code: a.ifsc_code ?? '', account_holder_name: a.account_holder_name ?? '',
    })
    setEditOpen(true)
  }

  async function handleSaveEdit() {
    if (!editTarget) return
    setSaving(true)
    try {
      if (editForm.pincode && !/^\d{6}$/.test(editForm.pincode)) { toast.error('Pincode must be 6 digits'); return }
      let photo_url = editForm.photo_url ?? null
      if (editPhoto) {
        const path = `associate-docs/${editTarget.id}/photo-${Date.now()}.${editPhoto.name.split('.').pop()}`
        const { error: upErr } = await supabase.storage.from('student-documents').upload(path, editPhoto, { upsert: true })
        if (upErr) { toast.error(`Photo upload failed: ${upErr.message}`); return }
        photo_url = supabase.storage.from('student-documents').getPublicUrl(path).data.publicUrl
      }
      // Newly picked documents replace the stored ones; untouched ones keep their URL
      const docUrls: Partial<Record<`${DocKey}_doc_url`, string>> = {}
      for (const key of DOC_KEYS) {
        const file = editDocs[key]
        if (!file) continue
        const path = `associate-docs/${editTarget.id}/${key}-${Date.now()}.${file.name.split('.').pop()}`
        const { error: upErr } = await supabase.storage.from('student-documents').upload(path, file, { upsert: true })
        if (upErr) { toast.error(`${DOC_LABELS[key]} upload failed: ${upErr.message}`); return }
        docUrls[`${key}_doc_url`] = supabase.storage.from('student-documents').getPublicUrl(path).data.publicUrl
      }
      const { error } = await db.from('associates').update({
        ...editForm,
        ...docUrls,
        photo_url,
        updated_at: new Date().toISOString(),
      }).eq('id', editTarget.id)
      if (error) { toast.error(error.message); return }
      toast.success('Associate updated')
      setEditOpen(false)
      load()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db.from('associates').delete().eq('id', deleteTarget.id)
      if (error) { toast.error(error.message); return }
      toast.success(`${deleteTarget.name} deleted`)
      setDeleteOpen(false)
      load()
    } finally { setDeleting(false) }
  }

  async function setActivityStatus(a: Associate, value: ActivityStatus) {
    setStatusSavingId(a.id)
    const { error } = await db.from('associates')
      .update({ activity_status: value, updated_at: new Date().toISOString() }).eq('id', a.id)
    setStatusSavingId(null)
    if (error) { toast.error(error.message); return }
    setAssociates(prev => prev.map(x => x.id === a.id ? { ...x, activity_status: value } : x))
    toast.success(`${a.name} marked ${ACTIVITY_LABELS[value]}`)
  }

  const base = lockedStatus ? associates.filter(a => a.status === lockedStatus) : associates
  const showStats = lockedStatus === 'approved'

  // Per-associate admissions / active students / revenue.
  // students.referred_by_associate holds either the associate's id or its code.
  const statsByAssoc = new Map<string, typeof EMPTY_STATS>()
  {
    const keyToId = new Map<string, string>()
    associates.forEach(a => { keyToId.set(a.id, a.id); if (a.associate_code) keyToId.set(a.associate_code, a.id) })
    for (const s of aggStudents) {
      const id = keyToId.get(s.referred_by_associate)
      if (!id) continue
      const st = statsByAssoc.get(id) ?? { ...EMPTY_STATS }
      st.admissions += 1
      if (s.status === 'active') st.active += 1
      st.revenue += s.total_fee ?? 0
      st.received += s.amount_paid ?? 0
      statsByAssoc.set(id, st)
    }
  }
  const statsOf = (a: Associate) => statsByAssoc.get(a.id) ?? EMPTY_STATS
  const activityOf = (a: Associate): ActivityStatus => a.activity_status ?? 'active'

  const allStates = [...new Set(base.map(a => a.state).filter(Boolean))].sort() as string[]
  const allDistricts = [...new Set(
    base.filter(a => !filterState || a.state === filterState).map(a => a.district).filter(Boolean)
  )].sort() as string[]

  const matched = base.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      a.name.toLowerCase().includes(q) ||
      a.phone.includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.institution_name ?? '').toLowerCase().includes(q) ||
      (a.district ?? '').toLowerCase().includes(q)
    const coord = a.coordinator_name ?? 'Unassigned'
    const matchCoord = coordFilter === 'all'
      || (coordFilter === 'unassigned' && coord === 'Unassigned')
      || coord === coordFilter
    return matchSearch && matchCoord &&
      (!filterState || a.state === filterState) &&
      (!filterDistrict || a.district === filterDistrict) &&
      (!filterStatus || a.status === filterStatus) &&
      matchStats(a)
  })

  function matchStats(a: Associate) {
    const st = statsOf(a)
    return (!filterActivity || activityOf(a) === filterActivity) &&
      (!filterAdmissions || (filterAdmissions === 'none' ? st.admissions === 0 : st.admissions >= Number(filterAdmissions))) &&
      (!filterActiveStudents || (filterActiveStudents === 'none' ? st.active === 0 : st.active > 0)) &&
      (!filterRevenue || (filterRevenue === 'none' ? st.revenue === 0 : st.revenue >= Number(filterRevenue)))
  }

  // Highest first; ties keep the newest-first server order
  const filtered = sortBy
    ? [...matched].sort((x, y) => {
        const key = sortBy as 'admissions' | 'active' | 'revenue'
        return statsOf(y)[key] - statsOf(x)[key]
      })
    : matched

  const statsFiltersOn = !!(filterActivity || filterAdmissions || filterActiveStudents || filterRevenue || sortBy)
  function clearFilters() {
    setSearch(''); setFilterState(''); setFilterDistrict(''); setFilterStatus('')
    setFilterActivity(''); setFilterAdmissions(''); setFilterActiveStudents(''); setFilterRevenue(''); setSortBy('')
  }

  // ── Pagination ──
  const filterKey = [search, filterState, filterDistrict, filterStatus, coordFilter, pageSize,
    filterActivity, filterAdmissions, filterActiveStudents, filterRevenue, sortBy].join('|')
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(pageState.key === filterKey ? pageState.page : 1, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pageRows = filtered.slice(pageStart, pageStart + pageSize)
  const goToPage = (p: number) => setPageState({ key: filterKey, page: Math.min(Math.max(1, p), totalPages) })
  const windowStart = Math.max(1, Math.min(safePage - 2, totalPages - 4))
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, i) => windowStart + i)

  // Exports every row matching the current filters (all pages, not just the visible one)
  function exportExcel() {
    const rows = filtered.map((a, i) => ({
      'S.No': i + 1,
      'Associate Code': a.associate_code ?? '',
      Name: a.name,
      Phone: a.phone,
      Email: a.email,
      "Father's Name": a.father_name ?? a.father_phone ?? '',
      Coordinator: a.coordinator_name ?? 'Unassigned',
      State: a.state ?? '',
      District: a.district ?? '',
      City: a.city ?? '',
      Institution: a.institution_name ?? '',
      Status: a.status.charAt(0).toUpperCase() + a.status.slice(1),
      ...(showStats ? {
        'Associate Status': ACTIVITY_LABELS[activityOf(a)],
        'Total Admissions': statsOf(a).admissions,
        'Active Students': statsOf(a).active,
        'Total Revenue': statsOf(a).revenue,
        'Received': statsOf(a).received,
      } : {}),
      'Wallet Balance': a.wallet_balance ?? 0,
      'Joined On': new Date(a.created_at).toLocaleDateString('en-IN'),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [6, 14, 22, 13, 26, 20, 16, 16, 16, 14, 24, 10, 14, 12].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Associates')
    const tag = [lockedStatus ?? filterStatus, coordFilter !== 'all' ? coordFilter : '', filterState, filterDistrict]
      .filter(Boolean).join('_').replace(/[^\w-]+/g, '_')
    XLSX.writeFile(wb, `DCW_Associates${tag ? `_${tag}` : ''}.xlsx`)
  }

  const statusBadge = (s: AssociateStatus) => {
    if (s === 'approved') return <Badge className="bg-green-100 text-green-800 border-0 gap-1"><CheckCircle2 className="w-3 h-3" />Approved</Badge>
    if (s === 'rejected') return <Badge className="bg-red-100 text-red-800 border-0 gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>
    return <Badge className="bg-amber-100 text-amber-800 border-0 gap-1"><Clock className="w-3 h-3" />Pending</Badge>
  }

  const pending = associates.filter(a => a.status === 'pending').length
  const approved = associates.filter(a => a.status === 'approved').length

  // ── Aggregate dashboard across all associates ──
  // Map associate id + code → coordinator name (referred_by_associate can be either)
  const coordMap: Record<string, string> = {}
  associates.forEach(a => {
    const name = a.coordinator_name ?? 'Unassigned'
    if (a.id) coordMap[a.id] = name
    if (a.associate_code) coordMap[a.associate_code] = name
  })
  const totalStudents = aggStudents.length
  const totalRevenue = aggStudents.reduce((s, x) => s + (x.total_fee ?? 0), 0)
  const totalReceived = aggStudents.reduce((s, x) => s + (x.amount_paid ?? 0), 0)
  const fmtAgg = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`

  const studentsByCoordinator = Object.entries(
    aggStudents.reduce((acc: Record<string, number>, x: any) => {
      const c = coordMap[x.referred_by_associate] ?? 'Unassigned'
      acc[c] = (acc[c] ?? 0) + 1; return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  const studentsByBoard = Object.entries(
    aggStudents.reduce((acc: Record<string, number>, x: any) => {
      const b = x.sub_section?.name ?? 'Unassigned'
      acc[b] = (acc[b] ?? 0) + 1; return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  const associatesByCoordinator = Object.entries(
    base.reduce((acc: Record<string, number>, a: any) => {
      const c = a.coordinator_name ?? 'Unassigned'
      acc[c] = (acc[c] ?? 0) + 1; return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  const ef = (k: keyof typeof editForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm(p => ({ ...p, [k]: e.target.value }))

  const INDIA_STATES = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
    'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
    'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
    'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
    'Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
    'Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu and Kashmir',
    'Ladakh','Lakshadweep','Puducherry',
  ]

  return (
    <div className="space-y-5">
      {/* Toolbar: Add Associate */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {lockedStatus === 'approved' ? 'Approved Associates' : 'All Associates'}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportExcel} disabled={loading || filtered.length === 0}
            className="gap-1.5 h-8 text-green-700 border-green-200 hover:bg-green-50">
            <Download className="w-3.5 h-3.5" /> Export Excel ({filtered.length})
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 h-8">
            <UserPlus className="w-3.5 h-3.5" /> Add Associate
          </Button>
        </div>
      </div>

      {/* Coordinator filter chips (which coordinator has how many associates) */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setCoordFilter('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${coordFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
          All <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${coordFilter === 'all' ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{base.length}</span>
        </button>
        {associatesByCoordinator.filter(([c]) => c !== 'Unassigned').map(([c, n]) => (
          <button key={c} onClick={() => setCoordFilter(c)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${coordFilter === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
            {c} <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${coordFilter === c ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{n}</span>
          </button>
        ))}
        {(() => {
          const un = associatesByCoordinator.find(([c]) => c === 'Unassigned')?.[1] ?? 0
          return un > 0 ? (
            <button onClick={() => setCoordFilter('unassigned')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${coordFilter === 'unassigned' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-600 border-amber-200 hover:border-amber-400'}`}>
              Unassigned <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${coordFilter === 'unassigned' ? 'bg-white/20' : 'bg-amber-100'}`}>{un}</span>
            </button>
          ) : null
        })()}
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, institution…"
            className="w-full pl-8 pr-3 h-8 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {!lockedStatus && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border rounded-lg px-2 h-8 text-xs bg-white min-w-28">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
        <select value={filterState} onChange={e => { setFilterState(e.target.value); setFilterDistrict('') }}
          className="border rounded-lg px-2 h-8 text-xs bg-white min-w-32">
          <option value="">All States</option>
          {allStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}
          className="border rounded-lg px-2 h-8 text-xs bg-white min-w-32">
          <option value="">All Districts</option>
          {allDistricts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {showStats && (
          <>
            <select value={filterActivity} onChange={e => setFilterActivity(e.target.value)}
              className="border rounded-lg px-2 h-8 text-xs bg-white min-w-32" title="Associate status">
              <option value="">All Assoc. Status</option>
              <option value="active">Active</option>
              <option value="inactive">Non Active</option>
              <option value="hold">Hold</option>
            </select>
            <select value={filterAdmissions} onChange={e => setFilterAdmissions(e.target.value)}
              className="border rounded-lg px-2 h-8 text-xs bg-white min-w-32" title="Total admissions">
              <option value="">All Admissions</option>
              <option value="none">No admissions</option>
              <option value="1">1+ admissions</option>
              <option value="5">5+ admissions</option>
              <option value="10">10+ admissions</option>
            </select>
            <select value={filterActiveStudents} onChange={e => setFilterActiveStudents(e.target.value)}
              className="border rounded-lg px-2 h-8 text-xs bg-white min-w-32" title="Active students">
              <option value="">All Active Students</option>
              <option value="some">Has active students</option>
              <option value="none">No active students</option>
            </select>
            <select value={filterRevenue} onChange={e => setFilterRevenue(e.target.value)}
              className="border rounded-lg px-2 h-8 text-xs bg-white min-w-32" title="Total revenue">
              <option value="">All Revenue</option>
              <option value="none">No revenue</option>
              <option value="10000">₹10,000+</option>
              <option value="50000">₹50,000+</option>
              <option value="100000">₹1,00,000+</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="border rounded-lg px-2 h-8 text-xs bg-white min-w-36" title="Sort">
              <option value="">Sort: Newest</option>
              <option value="admissions">Sort: Most Admissions</option>
              <option value="active">Sort: Most Active Students</option>
              <option value="revenue">Sort: Highest Revenue</option>
            </select>
          </>
        )}
        {(search || filterState || filterDistrict || filterStatus || statsFiltersOn) && (
          <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline px-1">Clear</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
      ) : base.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{lockedStatus === 'approved' ? 'No approved associates yet' : 'No associates yet'}</p>
          <p className="text-xs mt-1">Click "Add Associate" to register one</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">S.No</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Associate Code</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Coordinator</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">State / District</th>
                {showStats ? (
                  <>
                    <th className="text-center px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Total Admissions</th>
                    <th className="text-center px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Active Students</th>
                    <th className="text-right px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Total Revenue</th>
                    <th className="text-center px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Associate Status</th>
                  </>
                ) : (
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                )}
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pageRows.map((a, idx) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => router.push(`/associates/${a.id}`)}>
                  <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">{pageStart + idx + 1}</td>
                  <td className="px-4 py-3">
                    {a.associate_code
                      ? <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg whitespace-nowrap">{a.associate_code}</span>
                      : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{a.name}</td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell whitespace-nowrap">{fmtPhone(a.phone)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {a.coordinator_name
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full"><UserCog className="w-3 h-3" />{a.coordinator_name}</span>
                      : <span className="text-slate-400 text-xs">— Not set —</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {a.state ? <p className="text-xs font-medium text-slate-700">{a.state}</p> : null}
                    {a.district ? <p className="text-[11px] text-slate-400">{a.district}</p> : null}
                    {!a.state && !a.district && <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  {showStats ? (() => {
                    const st = statsOf(a)
                    const act = activityOf(a)
                    return (
                      <>
                        <td className="px-3 py-3 text-center font-semibold tabular-nums text-gray-900">{st.admissions}</td>
                        <td className="px-3 py-3 text-center tabular-nums">
                          <span className={st.active > 0 ? 'font-semibold text-green-700' : 'text-slate-400'}>{st.active}</span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <p className="font-semibold tabular-nums text-gray-900">{inr(st.revenue)}</p>
                          {st.revenue > 0 && <p className="text-[10px] text-slate-400 tabular-nums">Rcvd {inr(st.received)}</p>}
                        </td>
                        <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                          {canSeeAllAssociates ? (
                            <select value={act} disabled={statusSavingId === a.id}
                              onChange={e => setActivityStatus(a, e.target.value as ActivityStatus)}
                              className={`border rounded-full px-2 h-7 text-xs font-semibold cursor-pointer disabled:opacity-50 ${ACTIVITY_STYLES[act]}`}>
                              <option value="active">Active</option>
                              <option value="inactive">Non Active</option>
                              <option value="hold">Hold</option>
                            </select>
                          ) : (
                            <span className={`inline-block border rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTIVITY_STYLES[act]}`}>{ACTIVITY_LABELS[act]}</span>
                          )}
                        </td>
                      </>
                    )
                  })() : (
                    <td className="px-4 py-3 text-center">{statusBadge(a.status)}</td>
                  )}
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {a.status === 'approved' && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => { setCredAssoc(a); setCredOpen(true) }}>
                          <KeyRound className="w-3.5 h-3.5" /> ID & Pass
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => router.push(`/associates/${a.id}`)}>
                        <Eye className="w-3.5 h-3.5" /> View <ChevronRight className="w-3 h-3" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => openEdit(a)} title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => { setDeleteTarget(a); setDeleteOpen(true) }} title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-sm text-slate-400">No associates match these filters</div>
          )}
          {/* Pagination bar */}
          <div className="px-4 py-2.5 border-t bg-slate-50 flex items-center justify-between gap-3 flex-wrap text-xs text-slate-500">
            <div className="flex items-center gap-2 flex-wrap">
              <span>Rows per page</span>
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                className="border rounded-md px-1.5 h-7 bg-white text-slate-700">
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="tabular-nums">
                {filtered.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} of {filtered.length}
                {filtered.length !== base.length && ` (filtered from ${base.length})`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={safePage === 1}
                onClick={() => goToPage(safePage - 1)} title="Previous page">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {pageNumbers.map(p => (
                <Button key={p} variant={p === safePage ? 'default' : 'outline'} size="sm"
                  className="h-7 min-w-7 px-2 text-xs tabular-nums" onClick={() => goToPage(p)}>
                  {p}
                </Button>
              ))}
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={safePage === totalPages}
                onClick={() => goToPage(safePage + 1)} title="Next page">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog — admin only */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" /> Edit Associate — {editTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            <Sec title="Personal Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <F label="Full Name"><Input value={editForm.name ?? ''} onChange={ef('name')} /></F>
                <F label="Mobile"><Input value={editForm.phone ?? ''} onChange={ef('phone')} /></F>
                <F label="Father's Name"><Input value={editForm.father_name ?? ''} onChange={ef('father_name')} /></F>
                <F label="Email"><Input type="email" value={editForm.email ?? ''} onChange={ef('email')} /></F>
                <F label="Aadhaar Number"><Input value={editForm.aadhar_number ?? ''} onChange={ef('aadhar_number')} /></F>
                <F label="PAN Number"><Input value={editForm.pan_number ?? ''} onChange={ef('pan_number')} className="uppercase" /></F>
                <F label="State">
                  <select value={editForm.state ?? ''} onChange={e => setEditForm(p => ({ ...p, state: e.target.value }))}
                    className="w-full border rounded-md px-3 h-10 text-sm bg-white focus:ring-2 focus:ring-ring focus:outline-none">
                    <option value="">Select state…</option>
                    {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </F>
                <F label="District"><Input value={editForm.district ?? ''} onChange={ef('district')} placeholder="e.g. Jaipur" /></F>
                <F label="City"><Input value={editForm.city ?? ''} onChange={ef('city')} placeholder="e.g. Jaipur" /></F>
                <F label="Pincode"><Input value={editForm.pincode ?? ''} inputMode="numeric" maxLength={6} placeholder="800020"
                  onChange={e => setEditForm(p => ({ ...p, pincode: e.target.value.replace(/\D/g, '') }))} /></F>
              </div>
              <PhotoUpload
                preview={editPhotoPreview ?? editForm.photo_url ?? null}
                onSelect={f => {
                  if (f.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2 MB'); return }
                  setEditPhoto(f); setEditPhotoPreview(URL.createObjectURL(f))
                }}
                onClear={() => { setEditPhoto(null); setEditPhotoPreview(null); setEditForm(p => ({ ...p, photo_url: null })) }}
              />
            </Sec>
            <Sec title="Institution Details">
              <div className="grid grid-cols-1 gap-4">
                <F label="Institution Name"><Input value={editForm.institution_name ?? ''} onChange={ef('institution_name')} /></F>
                <F label="Institution Address">
                  <Textarea rows={3} value={editForm.institution_address ?? ''} className="resize-y"
                    onChange={e => setEditForm(p => ({ ...p, institution_address: e.target.value }))} />
                </F>
              </div>
            </Sec>
            <Sec title="Bank Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <F label="Account Holder Name"><Input value={editForm.account_holder_name ?? ''} onChange={ef('account_holder_name')} /></F>
                <F label="Bank Name"><Input value={editForm.bank_name ?? ''} onChange={ef('bank_name')} /></F>
                <F label="Account Number"><Input value={editForm.account_number ?? ''} onChange={ef('account_number')} /></F>
                <F label="IFSC Code"><Input value={editForm.ifsc_code ?? ''} onChange={ef('ifsc_code')} className="uppercase" /></F>
              </div>
            </Sec>
            <Sec title="Documents">
              <p className="text-xs text-slate-500 -mt-1 mb-1">Upload scanned copies or photos (JPG, PNG, PDF). Changes save with &quot;Save Changes&quot;.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {DOC_KEYS.map(key => (
                  <EditDocUpload key={key} label={DOC_LABELS[key]}
                    file={editDocs[key]}
                    existingUrl={editForm[`${key}_doc_url`] ?? null}
                    onSelect={f => {
                      if (f.size > 5 * 1024 * 1024) { toast.error(`${DOC_LABELS[key]} must be under 5 MB`); return }
                      setEditDocs(d => ({ ...d, [key]: f }))
                    }}
                    onClearFile={() => setEditDocs(d => ({ ...d, [key]: null }))}
                    onRemoveExisting={() => setEditForm(p => ({ ...p, [`${key}_doc_url`]: null }))}
                  />
                ))}
              </div>
            </Sec>
            <div className="flex gap-3 justify-end pt-1">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={saving} className="min-w-28">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog — admin only */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Associate
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </p>
            {deleteTarget?.status === 'approved' && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                This associate has a login account. Their Supabase auth user will remain — remove it manually from Supabase Auth if needed.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
                {deleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={credOpen} onOpenChange={setCredOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <KeyRound className="w-5 h-5" /> Login Credentials — {credAssoc?.name}
            </DialogTitle>
          </DialogHeader>
          {credAssoc && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                <CredRow label="Associate Code (ID)" value={credAssoc.associate_code ?? ''} />
                <CredRow label="Login Email" value={credAssoc.email} />
                <CredRow label="Password" value={credAssoc.temp_password ?? ''} />
              </div>
              {!credAssoc.temp_password && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Password not stored — use Reset Password below to generate a new one.
                </p>
              )}
              <Button
                variant="outline"
                className="w-full gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                disabled={resettingPass}
                onClick={async () => {
                  if (!confirm(`Reset password for ${credAssoc.name}? They will receive a notification with the new password.`)) return
                  setResettingPass(true)
                  try {
                    const res = await fetch(withBase('/api/associates/reset-password'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ associate_id: credAssoc.id }),
                    })
                    const json = await res.json()
                    if (!res.ok) throw new Error(json.error ?? 'Reset failed')
                    const updated = { ...credAssoc, temp_password: json.password }
                    setCredAssoc(updated)
                    setAssociates(prev => prev.map(a => a.id === credAssoc.id ? updated : a))
                    toast.success('Password reset! New password is now visible above.')
                  } catch (e: any) {
                    toast.error(e.message ?? 'Reset failed')
                  } finally {
                    setResettingPass(false)
                  }
                }}
              >
                <RefreshCw className={`w-4 h-4 ${resettingPass ? 'animate-spin' : ''}`} />
                {resettingPass ? 'Resetting…' : 'Reset Password'}
              </Button>
              <Button className="w-full" onClick={() => setCredOpen(false)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CreateAssociateDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={load} />
    </div>
  )
}

/** Document slot in the edit dialog: shows the stored file (view/replace/remove) or a picked replacement. */
function EditDocUpload({ label, file, existingUrl, onSelect, onClearFile, onRemoveExisting }: {
  label: string
  file: File | null
  existingUrl: string | null
  onSelect: (f: File) => void
  onClearFile: () => void
  onRemoveExisting: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f); e.target.value = '' }} />
      {file ? (
        <div className="flex items-center gap-2 border border-green-300 bg-green-50 rounded-lg px-3 py-2.5 text-sm">
          <FileCheck2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-green-800 text-xs truncate flex-1">{file.name}</span>
          <button type="button" onClick={onClearFile} title="Cancel this file" className="text-green-500 hover:text-red-500 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : existingUrl ? (
        <div className="flex items-center gap-2 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 text-xs">
          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <a href={existingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 font-medium hover:underline flex-1 truncate">View ↗</a>
          <button type="button" onClick={() => ref.current?.click()} className="text-blue-600 hover:underline font-medium">Replace</button>
          <button type="button" onClick={onRemoveExisting} title="Remove" className="text-slate-400 hover:text-red-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-300 rounded-lg py-4 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
          <Upload className="w-5 h-5" />
          <span className="text-xs font-medium">Click to upload</span>
        </button>
      )}
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-4 space-y-3 bg-slate-50/60">
      <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  )
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  )
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-green-600 font-medium">{label}</p>
        <p className="font-mono text-sm font-semibold text-gray-900">{value || '—'}</p>
      </div>
      {value && (
        <button
          onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied`) }}
          className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors flex-shrink-0"
          title="Copy"
        >
          <Copy className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  UserPlus, Users, CheckCircle2, Clock, XCircle,
  ChevronRight, Eye, RefreshCw, KeyRound, Copy, Pencil, Trash2, Search, UserCog,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CreateAssociateDialog } from '@/components/associates/CreateAssociateDialog'

type AssociateStatus = 'pending' | 'approved' | 'rejected'

interface Associate {
  id: string
  name: string
  phone: string
  father_phone: string | null
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
  created_at: string
}

export function AssociateManager() {
  const router = useRouter()
  const supabase = createClient()
  const db = supabase as any
  const [isAdmin, setIsAdmin] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [associates, setAssociates] = useState<Associate[]>([])
  const [aggStudents, setAggStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [credOpen, setCredOpen] = useState(false)
  const [credAssoc, setCredAssoc] = useState<Associate | null>(null)
  const [resettingPass, setResettingPass] = useState(false)

  // Edit state
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Associate | null>(null)
  const [editForm, setEditForm] = useState<Partial<Associate>>({})
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Associate | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
      if ((data as any)?.role === 'admin') setIsAdmin(true)
    })
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data }, { data: studs }] = await Promise.all([
      db.from('associates').select('*').order('created_at', { ascending: false }),
      db.from('students')
        .select('id, total_fee, amount_paid, status, referred_by_associate, sub_section:department_sub_sections(name)')
        .not('referred_by_associate', 'is', null),
    ])
    setAssociates((data ?? []) as Associate[])
    setAggStudents((studs ?? []) as any[])
    setLoading(false)
  }, [db])

  useEffect(() => { load() }, [load])

  function openEdit(a: Associate) {
    setEditTarget(a)
    setEditForm({
      name: a.name, phone: a.phone, father_phone: a.father_phone ?? '',
      email: a.email, aadhar_number: a.aadhar_number ?? '', pan_number: a.pan_number ?? '',
      state: a.state ?? '', district: a.district ?? '', city: a.city ?? '',
      institution_name: a.institution_name ?? '', institution_address: a.institution_address ?? '',
      current_address: a.current_address ?? '', current_city: a.current_city ?? '',
      current_state: a.current_state ?? '', current_pincode: a.current_pincode ?? '',
      same_as_current: a.same_as_current,
      permanent_address: a.permanent_address ?? '', permanent_city: a.permanent_city ?? '',
      permanent_state: a.permanent_state ?? '', permanent_pincode: a.permanent_pincode ?? '',
      bank_name: a.bank_name ?? '', account_number: a.account_number ?? '',
      ifsc_code: a.ifsc_code ?? '', account_holder_name: a.account_holder_name ?? '',
    })
    setEditOpen(true)
  }

  async function handleSaveEdit() {
    if (!editTarget) return
    setSaving(true)
    try {
      const { error } = await db.from('associates').update({
        ...editForm,
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

  const allStates = [...new Set(associates.map(a => a.state).filter(Boolean))].sort() as string[]
  const allDistricts = [...new Set(
    associates.filter(a => !filterState || a.state === filterState).map(a => a.district).filter(Boolean)
  )].sort() as string[]

  const filtered = associates.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      a.name.toLowerCase().includes(q) ||
      a.phone.includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.institution_name ?? '').toLowerCase().includes(q) ||
      (a.district ?? '').toLowerCase().includes(q)
    return matchSearch &&
      (!filterState || a.state === filterState) &&
      (!filterDistrict || a.district === filterDistrict) &&
      (!filterStatus || a.status === filterStatus)
  })

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
    associates.reduce((acc: Record<string, number>, a: any) => {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-700">Associates Overview</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 h-8">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 h-8">
            <UserPlus className="w-3.5 h-3.5" /> Add Associate
          </Button>
        </div>
      </div>

      {/* ── Total Dashboard ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { label: 'Total Associates', value: associates.length.toString(), cls: 'bg-blue-50 border-blue-100 text-blue-700' },
          { label: 'Approved',         value: approved.toString(),          cls: 'bg-green-50 border-green-100 text-green-700' },
          { label: 'Pending',          value: pending.toString(),           cls: 'bg-amber-50 border-amber-100 text-amber-700' },
          { label: 'Students Referred',value: totalStudents.toString(),     cls: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
          { label: 'Total Fee',        value: fmtAgg(totalRevenue),         cls: 'bg-purple-50 border-purple-100 text-purple-700' },
          { label: 'Received',         value: fmtAgg(totalReceived),        cls: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl px-3 py-2.5 ${s.cls}`}>
            <p className="text-base sm:text-lg font-extrabold leading-tight truncate">{s.value}</p>
            <p className="text-[10px] font-semibold opacity-70 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {(studentsByCoordinator.length > 0 || studentsByBoard.length > 0) && (
        <div className="grid md:grid-cols-3 gap-3">
          {/* Associates by Coordinator */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5"><UserCog className="w-3.5 h-3.5" /> Associates by Coordinator</p>
            <div className="flex flex-wrap gap-1.5">
              {associatesByCoordinator.map(([c, n]) => (
                <span key={c} className="text-xs bg-blue-50 border border-blue-100 text-blue-700 rounded-lg px-2 py-1 font-semibold">{c} <span className="text-blue-500">· {n}</span></span>
              ))}
            </div>
          </div>
          {/* Students by Coordinator */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Students by Coordinator</p>
            <div className="flex flex-wrap gap-1.5">
              {studentsByCoordinator.length === 0 ? <span className="text-xs text-gray-300">—</span> : studentsByCoordinator.map(([c, n]) => (
                <span key={c} className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg px-2 py-1 font-semibold">{c} <span className="text-indigo-500">· {n}</span></span>
              ))}
            </div>
          </div>
          {/* Students by Board */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Students by Board</p>
            <div className="flex flex-wrap gap-1.5">
              {studentsByBoard.length === 0 ? <span className="text-xs text-gray-300">—</span> : studentsByBoard.map(([b, n]) => (
                <span key={b} className="text-xs bg-violet-50 border border-violet-100 text-violet-700 rounded-lg px-2 py-1 font-semibold">{b} <span className="text-violet-500">· {n}</span></span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border rounded-xl p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, institution…"
            className="w-full pl-8 pr-3 h-8 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-2 h-8 text-xs bg-white min-w-28">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
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
        {(search || filterState || filterDistrict || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterState(''); setFilterDistrict(''); setFilterStatus('') }}
            className="text-xs text-blue-600 hover:underline px-1">Clear</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
      ) : associates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No associates yet</p>
          <p className="text-xs mt-1">Click "Add Associate" to register one</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Coordinator</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">State / District</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => router.push(`/associates/${a.id}`)}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {a.name}
                    {a.associate_code && <span className="ml-1.5 text-[10px] font-mono text-slate-400">{a.associate_code}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{a.phone}</td>
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
                  <td className="px-4 py-3 text-center">{statusBadge(a.status)}</td>
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
          <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-500">
            Showing {filtered.length} of {associates.length} associates
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
                <F label="Father's Mobile"><Input value={editForm.father_phone ?? ''} onChange={ef('father_phone')} /></F>
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
              </div>
            </Sec>
            <Sec title="Institution Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <F label="Institution Name"><Input value={editForm.institution_name ?? ''} onChange={ef('institution_name')} /></F>
                <F label="Institution Address"><Input value={editForm.institution_address ?? ''} onChange={ef('institution_address')} /></F>
              </div>
            </Sec>
            <Sec title="Current Address">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <F label="Full Address" className="lg:col-span-3"><Input value={editForm.current_address ?? ''} onChange={ef('current_address')} /></F>
                <F label="City"><Input value={editForm.current_city ?? ''} onChange={ef('current_city')} /></F>
                <F label="State"><Input value={editForm.current_state ?? ''} onChange={ef('current_state')} /></F>
                <F label="Pincode"><Input value={editForm.current_pincode ?? ''} onChange={ef('current_pincode')} /></F>
              </div>
            </Sec>
            <Sec title="Permanent Address">
              <label className="flex items-center gap-2 mb-3 cursor-pointer w-fit">
                <input type="checkbox" className="w-4 h-4 rounded"
                  checked={editForm.same_as_current ?? false}
                  onChange={e => setEditForm(p => ({ ...p, same_as_current: e.target.checked }))} />
                <span className="text-sm font-medium text-slate-700">Same as current address</span>
              </label>
              {!editForm.same_as_current && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <F label="Full Address" className="lg:col-span-3"><Input value={editForm.permanent_address ?? ''} onChange={ef('permanent_address')} /></F>
                  <F label="City"><Input value={editForm.permanent_city ?? ''} onChange={ef('permanent_city')} /></F>
                  <F label="State"><Input value={editForm.permanent_state ?? ''} onChange={ef('permanent_state')} /></F>
                  <F label="Pincode"><Input value={editForm.permanent_pincode ?? ''} onChange={ef('permanent_pincode')} /></F>
                </div>
              )}
            </Sec>
            <Sec title="Bank Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <F label="Account Holder Name"><Input value={editForm.account_holder_name ?? ''} onChange={ef('account_holder_name')} /></F>
                <F label="Bank Name"><Input value={editForm.bank_name ?? ''} onChange={ef('bank_name')} /></F>
                <F label="Account Number"><Input value={editForm.account_number ?? ''} onChange={ef('account_number')} /></F>
                <F label="IFSC Code"><Input value={editForm.ifsc_code ?? ''} onChange={ef('ifsc_code')} className="uppercase" /></F>
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
                    const res = await fetch('/api/associates/reset-password', {
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

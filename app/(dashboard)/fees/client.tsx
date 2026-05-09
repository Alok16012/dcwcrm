'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { Download, RefreshCw, Search, IndianRupee, Plus, Pencil, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'

interface FeeRow {
  id: string
  actual_fee: number
  basic_percent: number
  standard_percent: number
  premium_percent: number
  notes: string | null
  department: { id: string; name: string } | null
  course: { id: string; name: string } | null
  session: { id: string; name: string } | null
}

interface Lookup { id: string; name: string }

const EMPTY_FORM = {
  department_id: '', course_id: '', session_id: '',
  actual_fee: '', basic_percent: '10', standard_percent: '20', premium_percent: '30', notes: '',
}

function calcFee(actual: number, pct: number) {
  return Math.round(actual + (actual * pct / 100))
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export function FeesClient() {
  const supabase = createClient()
  const db = supabase as any

  const [fees, setFees] = useState<FeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')

  // Filters
  const [search, setSearch] = useState('')
  const [departments, setDepartments] = useState<Lookup[]>([])
  const [courses, setCourses] = useState<Lookup[]>([])
  const [sessions, setSessions] = useState<Lookup[]>([])
  const [filterDept, setFilterDept] = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [filterSession, setFilterSession] = useState('')

  // Edit/Add dialog
  const [feeOpen, setFeeOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<FeeRow | null>(null)
  const [feeForm, setFeeForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<FeeRow | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canManage = ['admin', 'backend'].includes(userRole)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await db
      .from('fee_structures')
      .select('*, department:departments(id,name), course:courses(id,name), session:sessions(id,name)')
      .order('created_at', { ascending: false })
    setFees((data ?? []) as FeeRow[])
    setLoading(false)
  }, [db])

  useEffect(() => {
    // Get current user role
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole((data as any)?.role ?? '')
    })
    load()
    Promise.all([
      db.from('departments').select('id,name').eq('is_active', true).order('name'),
      db.from('courses').select('id,name').eq('is_active', true).order('name'),
      db.from('sessions').select('id,name').eq('is_active', true).order('name'),
    ]).then(([d, c, s]) => {
      setDepartments(d.data ?? [])
      setCourses(c.data ?? [])
      setSessions(s.data ?? [])
    })
  }, [load])

  const filtered = fees.filter(f => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      f.department?.name.toLowerCase().includes(q) ||
      f.course?.name.toLowerCase().includes(q) ||
      f.session?.name.toLowerCase().includes(q)
    return matchSearch &&
      (!filterDept || f.department?.id === filterDept) &&
      (!filterCourse || f.course?.id === filterCourse) &&
      (!filterSession || f.session?.id === filterSession)
  })

  function openAdd() {
    setEditTarget(null)
    setFeeForm(EMPTY_FORM)
    setFeeOpen(true)
  }

  function openEdit(f: FeeRow) {
    setEditTarget(f)
    setFeeForm({
      department_id: f.department?.id ?? '',
      course_id: f.course?.id ?? '',
      session_id: f.session?.id ?? '',
      actual_fee: String(f.actual_fee),
      basic_percent: String(f.basic_percent),
      standard_percent: String(f.standard_percent),
      premium_percent: String(f.premium_percent),
      notes: f.notes ?? '',
    })
    setFeeOpen(true)
  }

  async function handleSave() {
    if (!feeForm.department_id || !feeForm.course_id || !feeForm.session_id || !feeForm.actual_fee) {
      return
    }
    setSaving(true)
    const payload = {
      department_id: feeForm.department_id,
      course_id: feeForm.course_id,
      session_id: feeForm.session_id,
      actual_fee: Number(feeForm.actual_fee),
      basic_percent: Number(feeForm.basic_percent),
      standard_percent: Number(feeForm.standard_percent),
      premium_percent: Number(feeForm.premium_percent),
      notes: feeForm.notes || null,
      updated_at: new Date().toISOString(),
    }
    try {
      if (editTarget) {
        const { error } = await db.from('fee_structures').update(payload).eq('id', editTarget.id)
        if (error) { return }
      } else {
        const { error } = await db.from('fee_structures').insert(payload)
        if (error) { return }
      }
      setFeeOpen(false)
      load()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await db.from('fee_structures').delete().eq('id', deleteTarget.id)
      setDeleteOpen(false)
      load()
    } finally { setDeleting(false) }
  }

  function downloadExcel() {
    const rows = filtered.map(f => ({
      Department: f.department?.name ?? '—',
      Course: f.course?.name ?? '—',
      Session: f.session?.name ?? '—',
      'Actual Fee (₹)': f.actual_fee,
      'Basic %': f.basic_percent,
      'Basic Fee (₹)': calcFee(f.actual_fee, f.basic_percent),
      'Standard %': f.standard_percent,
      'Standard Fee (₹)': calcFee(f.actual_fee, f.standard_percent),
      'Premium %': f.premium_percent,
      'Premium Fee (₹)': calcFee(f.actual_fee, f.premium_percent),
      Notes: f.notes ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [20, 25, 15, 15, 10, 15, 12, 16, 12, 16, 20].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Fee Structure')
    XLSX.writeFile(wb, 'DCW_Fee_Structure.xlsx')
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Fee Structure" description="View course fees by department, course and session" />

      {/* Filters + Actions */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search department, course, session…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="border rounded-lg px-3 h-9 text-sm bg-white text-slate-700 min-w-36">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
            className="border rounded-lg px-3 h-9 text-sm bg-white text-slate-700 min-w-36">
            <option value="">All Courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterSession} onChange={e => setFilterSession(e.target.value)}
            className="border rounded-lg px-3 h-9 text-sm bg-white text-slate-700 min-w-32">
            <option value="">All Sessions</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 h-9">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={downloadExcel} disabled={filtered.length === 0} className="gap-1.5 h-9 bg-green-600 hover:bg-green-700">
            <Download className="w-3.5 h-3.5" /> Download Excel
          </Button>
          {canManage && (
            <Button size="sm" onClick={openAdd} className="gap-1.5 h-9">
              <Plus className="w-3.5 h-3.5" /> Add Fee
            </Button>
          )}
        </div>
        {(filterDept || filterCourse || filterSession || search) && (
          <button onClick={() => { setFilterDept(''); setFilterCourse(''); setFilterSession(''); setSearch('') }}
            className="text-xs text-blue-600 hover:underline">Clear filters</button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <IndianRupee className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No fee structures found</p>
          {canManage && <p className="text-xs mt-1">Click "Add Fee" to create one</p>}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Department</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Course</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Session</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Actual Fee</th>
                  <th className="text-center px-4 py-3 font-semibold text-amber-700 bg-amber-50/60">Basic</th>
                  <th className="text-center px-4 py-3 font-semibold text-blue-700 bg-blue-50/60">Standard</th>
                  <th className="text-center px-4 py-3 font-semibold text-purple-700 bg-purple-50/60">Premium</th>
                  {canManage && <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{f.department?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{f.course?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-slate-100 text-slate-700 border-0 text-xs">{f.session?.name ?? '—'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs hidden md:table-cell">
                      {fmt(f.actual_fee)}
                    </td>
                    <td className="px-4 py-3 bg-amber-50/40">
                      <div className="text-center">
                        <p className="font-bold text-amber-800 font-mono">{fmt(calcFee(f.actual_fee, f.basic_percent))}</p>
                        <p className="text-[10px] text-amber-500">{f.basic_percent}%</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 bg-blue-50/40">
                      <div className="text-center">
                        <p className="font-bold text-blue-800 font-mono">{fmt(calcFee(f.actual_fee, f.standard_percent))}</p>
                        <p className="text-[10px] text-blue-500">{f.standard_percent}%</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 bg-purple-50/40">
                      <div className="text-center">
                        <p className="font-bold text-purple-800 font-mono">{fmt(calcFee(f.actual_fee, f.premium_percent))}</p>
                        <p className="text-[10px] text-purple-500">{f.premium_percent}%</p>
                      </div>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => openEdit(f)} title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-red-600 hover:bg-red-50"
                            onClick={() => { setDeleteTarget(f); setDeleteOpen(true) }} title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t bg-slate-50 text-xs text-slate-500">
            Showing {filtered.length} of {fees.length} fee structures
          </div>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={feeOpen} onOpenChange={setFeeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-blue-600" />
              {editTarget ? 'Edit Fee Structure' : 'Add Fee Structure'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Department *</Label>
                <select value={feeForm.department_id} onChange={e => setFeeForm(p => ({ ...p, department_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 h-9 text-sm bg-white">
                  <option value="">Select…</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Course *</Label>
                <select value={feeForm.course_id} onChange={e => setFeeForm(p => ({ ...p, course_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 h-9 text-sm bg-white">
                  <option value="">Select…</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Session *</Label>
                <select value={feeForm.session_id} onChange={e => setFeeForm(p => ({ ...p, session_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 h-9 text-sm bg-white">
                  <option value="">Select…</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Actual Fee (₹) *</Label>
              <Input type="number" min="0" placeholder="e.g. 50000"
                value={feeForm.actual_fee} onChange={e => setFeeForm(p => ({ ...p, actual_fee: e.target.value }))} />
            </div>

            <div className="border rounded-xl p-4 space-y-3 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tier Markup (% added on top of actual fee)</p>
              <div className="grid grid-cols-3 gap-3">
                {(['basic', 'standard', 'premium'] as const).map(tier => {
                  const key = `${tier}_percent` as keyof typeof feeForm
                  const colors = { basic: 'amber', standard: 'blue', premium: 'purple' }
                  const color = colors[tier]
                  const computed = feeForm.actual_fee && feeForm[key]
                    ? calcFee(Number(feeForm.actual_fee), Number(feeForm[key])) : 0
                  return (
                    <div key={tier} className="space-y-1.5">
                      <Label className={`text-xs font-semibold text-${color}-700 capitalize`}>{tier}</Label>
                      <div className="relative">
                        <Input type="number" min="0" max="200"
                          value={feeForm[key]}
                          onChange={e => setFeeForm(p => ({ ...p, [key]: e.target.value }))}
                          className="pr-7" />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                      </div>
                      {computed > 0 && (
                        <p className={`text-xs font-bold text-${color}-700`}>{fmt(computed)}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Notes (optional)</Label>
              <Input placeholder="Any special remarks…" value={feeForm.notes}
                onChange={e => setFeeForm(p => ({ ...p, notes: e.target.value }))} />
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setFeeOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !feeForm.department_id || !feeForm.course_id || !feeForm.session_id || !feeForm.actual_fee} className="min-w-28">
                {saving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : editTarget ? 'Update' : 'Save'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Fee Structure
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Delete fee for <strong>{deleteTarget?.course?.name}</strong> — {deleteTarget?.session?.name}? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
                {deleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

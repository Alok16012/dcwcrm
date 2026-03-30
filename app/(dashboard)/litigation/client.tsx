'use client'
import { useState, useTransition, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, IndianRupee, Search,
  Building2, Scale,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency } from '@/types/app.types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Dept { id: string; name: string; dept_fund: number | null }
interface SubSection { id: string; name: string; department_id: string }
interface Session { id: string; name: string }

interface Litigation {
  id: string
  department_id: string
  sub_section_id: string | null
  session_id: string | null
  student_name: string
  father_name: string | null
  phone: string | null
  litigation_type: string | null
  reason: string | null
  litigation_amount: number
  amount_paid: number
  notes: string | null
  created_at: string
  department: { id: string; name: string } | null
  sub_section: { id: string; name: string } | null
  session: { id: string; name: string } | null
}

interface FormState {
  department_id: string
  sub_section_id: string
  session_id: string
  student_name: string
  father_name: string
  phone: string
  litigation_type: string
  reason: string
  litigation_amount: string
  notes: string
}

const LITIGATION_TYPES = [
  { value: 'court_case', label: 'Court Case' },
  { value: 'debt_recovery', label: 'Debt Recovery' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'rti', label: 'RTI' },
  { value: 'consumer_forum', label: 'Consumer Forum' },
  { value: 'other', label: 'Other' },
]

const EMPTY_FORM: FormState = {
  department_id: '',
  sub_section_id: '',
  session_id: '',
  student_name: '',
  father_name: '',
  phone: '',
  litigation_type: '',
  reason: '',
  litigation_amount: '',
  notes: '',
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = 'default' }: { label: string; value: string | number; color?: 'blue' | 'green' | 'amber' | 'red' | 'default' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    default: 'bg-gray-50 text-gray-700 border-gray-100',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function LitigationClient({
  departments,
  subSections,
  sessions,
  initialLitigations,
}: {
  departments: Dept[]
  subSections: SubSection[]
  sessions: Session[]
  initialLitigations: Litigation[]
}) {
  const supabase = createClient()
  const [litigations, setLitigations] = useState<Litigation[]>(initialLitigations)
  const [depts, setDepts] = useState<Dept[]>(departments)
  const [isPending, startTransition] = useTransition()

  // Filters
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')

  // Dialogs
  const [showForm, setShowForm] = useState(false)
  const [editLitigation, setEditLitigation] = useState<Litigation | null>(null)
  const [payLitigation, setPayLitigation] = useState<Litigation | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Litigation | null>(null)
  const [editFundDept, setEditFundDept] = useState<Dept | null>(null)
  const [fundValue, setFundValue] = useState('')

  // Form state
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formBoards, setFormBoards] = useState<SubSection[]>([])

  // ─── Derived stats ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return litigations.filter((l) => {
      if (deptFilter !== 'all' && l.department_id !== deptFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          l.student_name.toLowerCase().includes(q) ||
          (l.phone ?? '').includes(q) ||
          (l.father_name ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [litigations, deptFilter, search])

  const totalLitigation = filtered.reduce((s, l) => s + (l.litigation_amount ?? 0), 0)
  const totalPaid = filtered.reduce((s, l) => s + (l.amount_paid ?? 0), 0)
  const totalPending = totalLitigation - totalPaid

  function litTypeLabel(val: string | null) {
    return LITIGATION_TYPES.find((t) => t.value === val)?.label ?? val ?? '—'
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────
  function handleDeptChange(deptId: string | null) {
    if (!deptId) return
    setForm((f) => ({ ...f, department_id: deptId, sub_section_id: '' }))
    setFormBoards(subSections.filter((s) => s.department_id === deptId))
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setFormBoards([])
    setEditLitigation(null)
    setShowForm(true)
  }

  function openEdit(l: Litigation) {
    setForm({
      department_id: l.department_id,
      sub_section_id: l.sub_section_id ?? '',
      session_id: l.session_id ?? '',
      student_name: l.student_name,
      father_name: l.father_name ?? '',
      phone: l.phone ?? '',
      litigation_type: l.litigation_type ?? '',
      reason: l.reason ?? '',
      litigation_amount: String(l.litigation_amount),
      notes: l.notes ?? '',
    })
    setFormBoards(subSections.filter((s) => s.department_id === l.department_id))
    setEditLitigation(l)
    setShowForm(true)
  }

  function saveLitigation() {
    if (!form.student_name.trim()) { toast.error('Student name is required'); return }
    if (!form.department_id) { toast.error('Department is required'); return }
    const amt = parseFloat(form.litigation_amount) || 0

    startTransition(async () => {
      const selectQ = `*, department:departments(id,name), sub_section:department_sub_sections(id,name), session:sessions(id,name)`
      const payload = {
        department_id: form.department_id,
        sub_section_id: form.sub_section_id || null,
        session_id: form.session_id || null,
        student_name: form.student_name.trim(),
        father_name: form.father_name.trim() || null,
        phone: form.phone.trim() || null,
        litigation_type: form.litigation_type || null,
        reason: form.reason.trim() || null,
        litigation_amount: amt,
        notes: form.notes.trim() || null,
      }

      if (editLitigation) {
        const { error } = await supabase.from('department_litigations').update(payload as never).eq('id', editLitigation.id)
        if (error) { toast.error('Update failed: ' + error.message); return }
        const { data } = await supabase.from('department_litigations').select(selectQ).eq('id', editLitigation.id).single()
        if (data) setLitigations((prev) => prev.map((l) => l.id === editLitigation.id ? data as Litigation : l))
        toast.success('Litigation updated!')
      } else {
        const { data, error } = await supabase
          .from('department_litigations')
          .insert({ ...payload, amount_paid: 0 } as never)
          .select(selectQ)
          .single()
        if (error) { toast.error('Add failed: ' + error.message); return }
        setLitigations((prev) => [data as Litigation, ...prev])
        toast.success('Litigation added!')
      }
      setShowForm(false)
    })
  }

  function addPayment() {
    if (!payLitigation) return
    const adding = parseFloat(payAmount) || 0
    if (adding <= 0) { toast.error('Enter a valid amount'); return }
    const newPaid = (payLitigation.amount_paid ?? 0) + adding
    if (newPaid > payLitigation.litigation_amount) {
      toast.error('Paid amount cannot exceed litigation amount')
      return
    }
    startTransition(async () => {
      const { error } = await supabase.from('department_litigations').update({ amount_paid: newPaid } as never).eq('id', payLitigation.id)
      if (error) { toast.error('Payment failed: ' + error.message); return }
      setLitigations((prev) => prev.map((l) => l.id === payLitigation.id ? { ...l, amount_paid: newPaid } : l))
      toast.success(`₹${adding.toLocaleString('en-IN')} payment recorded!`)
      setPayLitigation(null)
      setPayAmount('')
    })
  }

  function deleteLitigation() {
    if (!deleteTarget) return
    startTransition(async () => {
      const { error } = await supabase.from('department_litigations').delete().eq('id', deleteTarget.id)
      if (error) { toast.error('Delete failed'); return }
      setLitigations((prev) => prev.filter((l) => l.id !== deleteTarget.id))
      toast.success('Litigation deleted')
    })
    setDeleteTarget(null)
  }

  function saveDeptFund() {
    if (!editFundDept) return
    const val = parseFloat(fundValue) || 0
    startTransition(async () => {
      const { error } = await supabase.from('departments').update({ dept_fund: val } as never).eq('id', editFundDept.id)
      if (error) { toast.error('Fund update failed'); return }
      setDepts((prev) => prev.map((d) => d.id === editFundDept.id ? { ...d, dept_fund: val } : d))
      toast.success('Department fund updated!')
      setEditFundDept(null)
    })
  }

  function statusBadge(l: Litigation) {
    const pending = l.litigation_amount - l.amount_paid
    if (pending <= 0) return <Badge className="bg-green-100 text-green-800 border-0 text-xs">Cleared</Badge>
    if (l.amount_paid > 0) return <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Partial</Badge>
    return <Badge className="bg-red-100 text-red-800 border-0 text-xs">Pending</Badge>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-600" /> Department Litigation
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track litigation cases & payments department-wise</p>
        </div>
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Litigation
        </Button>
      </div>

      {/* Department Fund Cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Department Fund Balance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {depts.map((d) => (
            <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">{d.name}</p>
                  <p className="text-lg font-bold text-indigo-700 mt-0.5">{formatCurrency(d.dept_fund ?? 0)}</p>
                </div>
                <button
                  onClick={() => { setEditFundDept(d); setFundValue(String(d.dept_fund ?? 0)) }}
                  className="w-6 h-6 rounded-md hover:bg-blue-50 text-blue-500 flex items-center justify-center"
                  title="Update fund"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Fund Balance</p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Cases" value={filtered.length} color="blue" />
        <StatCard label="Total Litigation" value={formatCurrency(totalLitigation)} color="amber" />
        <StatCard label="Amount Paid" value={formatCurrency(totalPaid)} color="green" />
        <StatCard label="Pending" value={formatCurrency(totalPending)} color={totalPending > 0 ? 'red' : 'default'} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone, father name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v ?? 'all')}>
          <SelectTrigger className="w-52 h-9">
            <Building2 className="w-4 h-4 mr-2 text-gray-400" />
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Scale className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No litigation cases found</p>
            <p className="text-sm text-gray-400 mt-1">Add your first litigation case</p>
            <Button className="mt-4 gap-1.5" onClick={openAdd}><Plus className="w-4 h-4" /> Add Litigation</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Department / Board</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Type / Session</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Reason</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Litigation</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Paid</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Pending</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((l) => {
                  const pending = l.litigation_amount - l.amount_paid
                  return (
                    <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{l.student_name}</p>
                        {l.father_name && <p className="text-xs text-gray-500">Father: {l.father_name}</p>}
                        {l.phone && <p className="text-xs text-gray-400">{l.phone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{l.department?.name ?? '—'}</p>
                        {l.sub_section && <p className="text-xs text-purple-600">{l.sub_section.name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {l.litigation_type && (
                          <p className="text-xs font-medium text-blue-700">{litTypeLabel(l.litigation_type)}</p>
                        )}
                        <p className="text-xs text-gray-500">{l.session?.name ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[160px] truncate">{l.reason ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(l.litigation_amount)}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-700">{formatCurrency(l.amount_paid)}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">{formatCurrency(pending)}</td>
                      <td className="px-4 py-3 text-center">{statusBadge(l)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {pending > 0 && (
                            <button
                              onClick={() => { setPayLitigation(l); setPayAmount('') }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium transition-colors"
                            >
                              <IndianRupee className="w-3 h-3" /> Pay
                            </button>
                          )}
                          <button onClick={() => openEdit(l)} className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 flex items-center justify-center">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(l)} className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-400 flex items-center justify-center">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-600" />
              {editLitigation ? 'Edit Litigation' : 'Add New Litigation'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Student Name *</label>
              <Input placeholder="Student name" value={form.student_name} onChange={(e) => setForm((f) => ({ ...f, student_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Father's Name</label>
                <Input placeholder="Father's name" value={form.father_name} onChange={(e) => setForm((f) => ({ ...f, father_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Phone Number</label>
                <Input placeholder="Mobile number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Department *</label>
              <Select value={form.department_id} onValueChange={handleDeptChange}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Board / University</label>
              <Select
                value={form.sub_section_id}
                onValueChange={(v) => setForm((f) => ({ ...f, sub_section_id: v ?? '' }))}
                disabled={!form.department_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.department_id ? 'Select board' : 'Select department first'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {formBoards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Session</label>
              <Select value={form.session_id} onValueChange={(v) => setForm((f) => ({ ...f, session_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Litigation Type</label>
              <Select value={form.litigation_type} onValueChange={(v) => setForm((f) => ({ ...f, litigation_type: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {LITIGATION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Reason for Litigation</label>
              <Input
                placeholder="Brief reason or case description"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Litigation Amount (₹)</label>
              <Input
                type="number"
                placeholder="Total litigation amount"
                value={form.litigation_amount}
                onChange={(e) => setForm((f) => ({ ...f, litigation_amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
              <Input
                placeholder="Additional notes (optional)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button className="flex-1" onClick={saveLitigation} disabled={isPending}>
                {isPending ? 'Saving...' : editLitigation ? 'Update' : 'Add'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={!!payLitigation} onOpenChange={(o) => { if (!o) { setPayLitigation(null); setPayAmount('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-green-600" /> Record Payment
            </DialogTitle>
          </DialogHeader>
          {payLitigation && (
            <div className="space-y-4 mt-2">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-gray-500">Student:</span> <span className="font-semibold">{payLitigation.student_name}</span></p>
                <p><span className="text-gray-500">Total:</span> <span className="font-semibold">{formatCurrency(payLitigation.litigation_amount)}</span></p>
                <p><span className="text-gray-500">Already Paid:</span> <span className="font-semibold text-green-700">{formatCurrency(payLitigation.amount_paid)}</span></p>
                <p><span className="text-gray-500">Pending:</span> <span className="font-semibold text-red-600">{formatCurrency(payLitigation.litigation_amount - payLitigation.amount_paid)}</span></p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Payment Amount (₹)</label>
                <Input
                  type="number"
                  autoFocus
                  placeholder="Amount received"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPayment()}
                />
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={addPayment} disabled={isPending}>
                  {isPending ? 'Saving...' : 'Record Payment'}
                </Button>
                <Button variant="outline" onClick={() => { setPayLitigation(null); setPayAmount('') }}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dept Fund Edit Dialog */}
      <Dialog open={!!editFundDept} onOpenChange={(o) => { if (!o) setEditFundDept(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" /> Update Department Fund
            </DialogTitle>
          </DialogHeader>
          {editFundDept && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-gray-600">Update fund balance for <span className="font-semibold">{editFundDept.name}</span></p>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Fund Amount (₹)</label>
                <Input
                  type="number"
                  autoFocus
                  value={fundValue}
                  onChange={(e) => setFundValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveDeptFund()}
                />
              </div>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={saveDeptFund} disabled={isPending}>
                  {isPending ? 'Saving...' : 'Update'}
                </Button>
                <Button variant="outline" onClick={() => setEditFundDept(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          open
          title="Delete Litigation"
          description={`"${deleteTarget.student_name}" litigation case will be permanently deleted.`}
          confirmLabel="Delete"
          destructive
          onConfirm={deleteLitigation}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

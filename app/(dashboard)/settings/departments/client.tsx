'use client'
import { useState, useTransition, useRef, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, Building2, School,
  X, Check, Scale, IndianRupee, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency } from '@/types/app.types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SubSectionRow { id: string; name: string; is_active: boolean; department_id: string }
interface DepartmentRow { id: string; name: string; is_active: boolean; department_sub_sections: SubSectionRow[]; dept_fund?: number | null }
interface SessionRow { id: string; name: string }

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

interface LitFormState {
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

const EMPTY_LIT_FORM: LitFormState = {
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

// ─── Inline Edit ──────────────────────────────────────────────────────────────
function InlineEdit({ value, onSave, onCancel, placeholder }: {
  value: string; onSave: (v: string) => void; onCancel: () => void; placeholder?: string
}) {
  const [text, setText] = useState(value)
  return (
    <div className="flex items-center gap-2 flex-1">
      <Input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(text); if (e.key === 'Escape') onCancel() }}
        placeholder={placeholder}
        className="h-8 text-sm border-blue-300 focus:border-blue-500"
      />
      <button onClick={() => onSave(text)} className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 flex-shrink-0">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={onCancel} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Add Sub Sections Panel ───────────────────────────────────────────────────
function AddSubSectionsPanel({ departmentId, onSave, onCancel, saving }: {
  departmentId: string
  onSave: (names: string[]) => void
  onCancel: () => void
  saving: boolean
}) {
  const [rows, setRows] = useState<string[]>([''])
  const lastInputRef = useRef<HTMLInputElement>(null)

  function updateRow(i: number, val: string) {
    setRows((prev) => prev.map((r, idx) => idx === i ? val : r))
  }
  function addRow() {
    setRows((prev) => [...prev, ''])
    setTimeout(() => lastInputRef.current?.focus(), 50)
  }
  function removeRow(i: number) {
    if (rows.length === 1) { setRows(['']); return }
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }
  function handleKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'Enter') { e.preventDefault(); addRow() }
    if (e.key === 'Escape') onCancel()
  }
  function handleSave() {
    const names = rows.map((r) => r.trim()).filter(Boolean)
    if (!names.length) { onCancel(); return }
    onSave(names)
  }

  return (
    <div className="border-t border-purple-200 bg-purple-50/40 px-4 py-3 space-y-2">
      <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <School className="w-3.5 h-3.5" /> Add University / Board
        <span className="text-purple-500 font-normal normal-case">(Press Enter for new row)</span>
      </p>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-purple-500 font-bold w-5 text-right flex-shrink-0">{i + 1}.</span>
            <Input
              ref={i === rows.length - 1 ? lastInputRef : undefined}
              value={row}
              onChange={(e) => updateRow(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              placeholder={`University / Board ${i + 1} name...`}
              className="h-8 text-sm bg-white border-purple-200 focus:border-purple-400"
              autoFocus={i === 0}
            />
            <button onClick={() => removeRow(i)} className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium mt-1 px-1">
        <Plus className="w-3.5 h-3.5" /> Add another
      </button>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || rows.every((r) => !r.trim())}
          className="bg-purple-600 hover:bg-purple-700 h-8 text-xs px-4"
        >
          {saving ? 'Saving...' : `Save ${rows.filter((r) => r.trim()).length} Item${rows.filter((r) => r.trim()).length !== 1 ? 's' : ''}`}
        </Button>
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancel</button>
      </div>
    </div>
  )
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
export function DepartmentsClient({
  departments: initial,
  subSections: allSubSections = [],
  sessions = [],
  initialLitigations = [],
}: {
  departments: DepartmentRow[]
  subSections?: { id: string; name: string; department_id: string }[]
  sessions?: SessionRow[]
  initialLitigations?: Litigation[]
}) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'departments' | 'litigation'>('departments')
  const [isPending, startTransition] = useTransition()

  // ── Department State ──
  const [departments, setDepartments] = useState(initial)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingDept, setEditingDept] = useState<string | null>(null)
  const [editingSub, setEditingSub] = useState<string | null>(null)
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null)
  const [addingDept, setAddingDept] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'dept' | 'sub'; id: string; name: string; deptId?: string } | null>(null)
  const [editFundDept, setEditFundDept] = useState<DepartmentRow | null>(null)
  const [fundValue, setFundValue] = useState('')

  // ── Litigation State ──
  const [litigations, setLitigations] = useState<Litigation[]>(initialLitigations)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [showLitForm, setShowLitForm] = useState(false)
  const [editLitigation, setEditLitigation] = useState<Litigation | null>(null)
  const [payLitigation, setPayLitigation] = useState<Litigation | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [deleteLitTarget, setDeleteLitTarget] = useState<Litigation | null>(null)
  const [litForm, setLitForm] = useState<LitFormState>(EMPTY_LIT_FORM)
  const [formBoards, setFormBoards] = useState<{ id: string; name: string; department_id: string }[]>([])

  // ── Litigation derived stats ──
  const filteredLit = useMemo(() => litigations.filter((l) => {
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
  }), [litigations, deptFilter, search])

  const totalLitigation = filteredLit.reduce((s, l) => s + (l.litigation_amount ?? 0), 0)
  const totalPaid = filteredLit.reduce((s, l) => s + (l.amount_paid ?? 0), 0)
  const totalPending = totalLitigation - totalPaid

  // ──────────────────────────────────────────────────────────────────────────
  // Department actions
  // ──────────────────────────────────────────────────────────────────────────
  function toggleExpand(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function saveDept(id: string, name: string) {
    if (!name.trim()) return
    startTransition(async () => {
      const { error } = await supabase.from('departments').update({ name: name.trim() } as never).eq('id', id)
      if (error) { toast.error('Failed to update'); return }
      setDepartments((prev) => prev.map((d) => d.id === id ? { ...d, name: name.trim() } : d))
      setEditingDept(null)
      toast.success('Department updated')
    })
  }

  async function addDept(name: string) {
    if (!name.trim()) { setAddingDept(false); return }
    startTransition(async () => {
      const { data, error } = await supabase.from('departments').insert({ name: name.trim() } as never).select().single()
      if (error) { toast.error(error.message); return }
      setDepartments((prev) => [...prev, { ...(data as any), department_sub_sections: [] }])
      setAddingDept(false)
      toast.success('Department added!')
    })
  }

  async function deleteDept(id: string) {
    startTransition(async () => {
      const { error } = await supabase.from('departments').delete().eq('id', id)
      if (error) { toast.error('Failed to delete'); return }
      setDepartments((prev) => prev.filter((d) => d.id !== id))
      toast.success('Department deleted')
    })
    setDeleteTarget(null)
  }

  async function saveSub(deptId: string, subId: string, name: string) {
    if (!name.trim()) return
    startTransition(async () => {
      const { error } = await supabase.from('department_sub_sections').update({ name: name.trim() } as never).eq('id', subId)
      if (error) { toast.error('Failed to update'); return }
      setDepartments((prev) => prev.map((d) => d.id === deptId
        ? { ...d, department_sub_sections: d.department_sub_sections.map((s) => s.id === subId ? { ...s, name: name.trim() } : s) }
        : d
      ))
      setEditingSub(null)
      toast.success('University/Board updated')
    })
  }

  async function addMultipleSubs(deptId: string, names: string[]) {
    startTransition(async () => {
      const rows = names.map((name) => ({ name, department_id: deptId }))
      const { data, error } = await supabase.from('department_sub_sections').insert(rows as never).select()
      if (error) { toast.error(error.message); return }
      setDepartments((prev) => prev.map((d) => d.id === deptId
        ? { ...d, department_sub_sections: [...d.department_sub_sections, ...(data ?? [])] }
        : d
      ))
      setAddingSubTo(null)
      setExpanded((prev) => new Set(prev).add(deptId))
      toast.success(`${names.length} items added!`)
    })
  }

  async function deleteSub(deptId: string, subId: string) {
    startTransition(async () => {
      const { error } = await supabase.from('department_sub_sections').delete().eq('id', subId)
      if (error) { toast.error('Failed to delete'); return }
      setDepartments((prev) => prev.map((d) => d.id === deptId
        ? { ...d, department_sub_sections: d.department_sub_sections.filter((s) => s.id !== subId) }
        : d
      ))
      toast.success('University/Board deleted')
    })
    setDeleteTarget(null)
  }

  function saveDeptFund() {
    if (!editFundDept) return
    const val = parseFloat(fundValue) || 0
    startTransition(async () => {
      const { error } = await supabase.from('departments').update({ dept_fund: val } as never).eq('id', editFundDept.id)
      if (error) { toast.error('Fund update failed'); return }
      setDepartments((prev) => prev.map((d) => d.id === editFundDept.id ? { ...d, dept_fund: val } : d))
      toast.success('Department fund updated!')
      setEditFundDept(null)
    })
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Litigation actions
  // ──────────────────────────────────────────────────────────────────────────
  function handleLitDeptChange(deptId: string | null) {
    if (!deptId) return
    setLitForm((f) => ({ ...f, department_id: deptId, sub_section_id: '' }))
    setFormBoards(allSubSections.filter((s) => s.department_id === deptId))
  }

  function openAddLit() {
    setLitForm(EMPTY_LIT_FORM)
    setFormBoards([])
    setEditLitigation(null)
    setShowLitForm(true)
  }

  function openEditLit(l: Litigation) {
    setLitForm({
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
    setFormBoards(allSubSections.filter((s) => s.department_id === l.department_id))
    setEditLitigation(l)
    setShowLitForm(true)
  }

  function saveLitigation() {
    if (!litForm.student_name.trim()) { toast.error('Student name is required'); return }
    if (!litForm.department_id) { toast.error('Department is required'); return }
    const amt = parseFloat(litForm.litigation_amount) || 0

    startTransition(async () => {
      const payload = {
        department_id: litForm.department_id,
        sub_section_id: litForm.sub_section_id || null,
        session_id: litForm.session_id || null,
        student_name: litForm.student_name.trim(),
        father_name: litForm.father_name.trim() || null,
        phone: litForm.phone.trim() || null,
        litigation_type: litForm.litigation_type || null,
        reason: litForm.reason.trim() || null,
        litigation_amount: amt,
        notes: litForm.notes.trim() || null,
      }

      const selectQ = `*, department:departments(id,name), sub_section:department_sub_sections(id,name), session:sessions(id,name)`

      if (editLitigation) {
        const { error } = await supabase.from('department_litigations').update(payload as never).eq('id', editLitigation.id)
        if (error) { toast.error('Update failed: ' + error.message); return }
        const { data } = await supabase.from('department_litigations').select(selectQ).eq('id', editLitigation.id).single()
        if (data) setLitigations((prev) => prev.map((l) => l.id === editLitigation.id ? data as Litigation : l))
        toast.success('Litigation updated!')
      } else {
        const { data, error } = await supabase.from('department_litigations').insert({ ...payload, amount_paid: 0 } as never).select(selectQ).single()
        if (error) { toast.error('Add failed: ' + error.message); return }
        setLitigations((prev) => [data as Litigation, ...prev])
        toast.success('Litigation added!')
      }
      setShowLitForm(false)
    })
  }

  function addPayment() {
    if (!payLitigation) return
    const adding = parseFloat(payAmount) || 0
    if (adding <= 0) { toast.error('Enter a valid amount'); return }
    const newPaid = (payLitigation.amount_paid ?? 0) + adding
    if (newPaid > payLitigation.litigation_amount) { toast.error('Paid amount cannot exceed litigation amount'); return }
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
    if (!deleteLitTarget) return
    startTransition(async () => {
      const { error } = await supabase.from('department_litigations').delete().eq('id', deleteLitTarget.id)
      if (error) { toast.error('Delete failed'); return }
      setLitigations((prev) => prev.filter((l) => l.id !== deleteLitTarget.id))
      toast.success('Litigation deleted')
    })
    setDeleteLitTarget(null)
  }

  function statusBadge(l: Litigation) {
    const pending = l.litigation_amount - l.amount_paid
    if (pending <= 0) return <Badge className="bg-green-100 text-green-800 border-0 text-xs">Cleared</Badge>
    if (l.amount_paid > 0) return <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Partial</Badge>
    return <Badge className="bg-red-100 text-red-800 border-0 text-xs">Pending</Badge>
  }

  function litTypeLabel(val: string | null) {
    return LITIGATION_TYPES.find((t) => t.value === val)?.label ?? val ?? '—'
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Department Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage departments, boards, and litigation cases</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'departments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Departments</span>
        </button>
        <button
          onClick={() => setActiveTab('litigation')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'litigation' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-2"><Scale className="w-4 h-4" /> Litigation</span>
        </button>
      </div>

      {/* ── Tab: Departments ── */}
      {activeTab === 'departments' && (
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Manage departments, universities and boards</p>
            <Button onClick={() => setAddingDept(true)} disabled={addingDept} className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Department
            </Button>
          </div>

          {addingDept && (
            <div className="bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <InlineEdit
                value=""
                placeholder="Department name e.g. Distance Education, Regular..."
                onSave={addDept}
                onCancel={() => setAddingDept(false)}
              />
            </div>
          )}

          {departments.length === 0 && !addingDept && (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No departments yet</p>
              <Button className="mt-4 gap-1.5" onClick={() => setAddingDept(true)}>
                <Plus className="w-4 h-4" /> Add Department
              </Button>
            </div>
          )}

          <div className="space-y-3">
            {departments.map((dept) => (
              <div key={dept.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleExpand(dept.id)}
                    className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0 transition-colors"
                  >
                    {expanded.has(dept.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                  </div>

                  {editingDept === dept.id ? (
                    <InlineEdit
                      value={dept.name}
                      placeholder="Department name"
                      onSave={(v) => saveDept(dept.id, v)}
                      onCancel={() => setEditingDept(null)}
                    />
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-gray-800">{dept.name}</span>
                        {dept.dept_fund != null && (
                          <span className="ml-2 text-xs text-indigo-600 font-medium">Fund: {formatCurrency(dept.dept_fund)}</span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs text-gray-500 border-gray-200 mr-1">
                        {dept.department_sub_sections.length} board{dept.department_sub_sections.length !== 1 ? 's' : ''}
                      </Badge>
                      <button
                        onClick={() => { setEditFundDept(dept); setFundValue(String(dept.dept_fund ?? 0)) }}
                        title="Update fund balance"
                        className="w-7 h-7 rounded-lg hover:bg-indigo-50 text-indigo-500 flex items-center justify-center transition-colors"
                      >
                        <IndianRupee className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setAddingSubTo(dept.id); setExpanded((p) => new Set(p).add(dept.id)) }}
                        title="Add sub-sections"
                        className="w-7 h-7 rounded-lg hover:bg-emerald-50 text-emerald-600 flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingDept(dept.id)}
                        className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 flex items-center justify-center transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ type: 'dept', id: dept.id, name: dept.name })}
                        className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-400 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>

                {expanded.has(dept.id) && (
                  <div className="border-t border-gray-100">
                    {addingSubTo === dept.id && (
                      <AddSubSectionsPanel
                        departmentId={dept.id}
                        saving={isPending}
                        onSave={(names) => addMultipleSubs(dept.id, names)}
                        onCancel={() => setAddingSubTo(null)}
                      />
                    )}
                    {dept.department_sub_sections.length === 0 && addingSubTo !== dept.id && (
                      <div className="px-16 py-3 text-xs text-gray-400 flex items-center gap-2 bg-gray-50/60">
                        <School className="w-3.5 h-3.5" />
                        No boards yet —
                        <button onClick={() => setAddingSubTo(dept.id)} className="text-purple-600 hover:underline font-medium">add one</button>
                      </div>
                    )}
                    {dept.department_sub_sections.length > 0 && (
                      <div className="bg-gray-50/60 divide-y divide-gray-100">
                        {dept.department_sub_sections.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5 group">
                            <div className="w-6 flex-shrink-0" />
                            <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center flex-shrink-0 ml-7">
                              <School className="w-3 h-3 text-purple-600" />
                            </div>
                            {editingSub === sub.id ? (
                              <InlineEdit
                                value={sub.name}
                                placeholder="University/Board name"
                                onSave={(v) => saveSub(dept.id, sub.id, v)}
                                onCancel={() => setEditingSub(null)}
                              />
                            ) : (
                              <>
                                <span className="text-sm text-gray-700 flex-1">{sub.name}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => setEditingSub(sub.id)} className="w-6 h-6 rounded-md hover:bg-blue-100 text-blue-500 flex items-center justify-center">
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setDeleteTarget({ type: 'sub', id: sub.id, name: sub.name, deptId: dept.id })} className="w-6 h-6 rounded-md hover:bg-red-100 text-red-400 flex items-center justify-center">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Litigation ── */}
      {activeTab === 'litigation' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-gray-600">Track litigation cases and payments department-wise</p>
            <Button onClick={openAddLit} className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Litigation
            </Button>
          </div>

          {/* Department Fund Cards */}
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Department Fund Balance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {departments.map((d) => (
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
            <StatCard label="Total Cases" value={filteredLit.length} color="blue" />
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
            {filteredLit.length === 0 ? (
              <div className="text-center py-16">
                <Scale className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No litigation cases found</p>
                <Button className="mt-4 gap-1.5" onClick={openAddLit}><Plus className="w-4 h-4" /> Add Litigation</Button>
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
                    {filteredLit.map((l) => {
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
                            {l.litigation_type && <p className="text-xs font-medium text-blue-700">{litTypeLabel(l.litigation_type)}</p>}
                            <p className="text-xs text-gray-500">{l.session?.name ?? '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px] truncate">{l.reason ?? '—'}</td>
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
                              <button onClick={() => openEditLit(l)} className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 flex items-center justify-center">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeleteLitTarget(l)} className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-400 flex items-center justify-center">
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
        </div>
      )}

      {/* ── Dept Fund Edit Dialog ── */}
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

      {/* ── Add/Edit Litigation Dialog ── */}
      <Dialog open={showLitForm} onOpenChange={setShowLitForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-600" />
              {editLitigation ? 'Edit Litigation' : 'Add New Litigation'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Student Name */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Student Name *</label>
              <Input
                placeholder="Student name"
                value={litForm.student_name}
                onChange={(e) => setLitForm((f) => ({ ...f, student_name: e.target.value }))}
              />
            </div>
            {/* Father Name + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Father's Name</label>
                <Input
                  placeholder="Father's name"
                  value={litForm.father_name}
                  onChange={(e) => setLitForm((f) => ({ ...f, father_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Phone Number</label>
                <Input
                  placeholder="Mobile number"
                  value={litForm.phone}
                  onChange={(e) => setLitForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            {/* Department */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Department *</label>
              <Select value={litForm.department_id} onValueChange={handleLitDeptChange}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Board */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Board / University</label>
              <Select
                value={litForm.sub_section_id}
                onValueChange={(v) => setLitForm((f) => ({ ...f, sub_section_id: v ?? '' }))}
                disabled={!litForm.department_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={litForm.department_id ? 'Select board' : 'Select department first'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {formBoards.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Session */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Session</label>
              <Select value={litForm.session_id} onValueChange={(v) => setLitForm((f) => ({ ...f, session_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Litigation Type */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Litigation Type</label>
              <Select value={litForm.litigation_type} onValueChange={(v) => setLitForm((f) => ({ ...f, litigation_type: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {LITIGATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Reason */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Reason for Litigation</label>
              <Input
                placeholder="Brief reason or case description"
                value={litForm.reason}
                onChange={(e) => setLitForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            {/* Litigation Amount */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Litigation Amount (₹)</label>
              <Input
                type="number"
                placeholder="Total litigation amount"
                value={litForm.litigation_amount}
                onChange={(e) => setLitForm((f) => ({ ...f, litigation_amount: e.target.value }))}
              />
            </div>
            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
              <Input
                placeholder="Additional notes (optional)"
                value={litForm.notes}
                onChange={(e) => setLitForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button className="flex-1" onClick={saveLitigation} disabled={isPending}>
                {isPending ? 'Saving...' : editLitigation ? 'Update' : 'Add'}
              </Button>
              <Button variant="outline" onClick={() => setShowLitForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Payment Dialog ── */}
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

      {/* ── Dept Delete Confirm ── */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title={`Delete ${deleteTarget.type === 'dept' ? 'Department' : 'University/Board'}`}
          description={`"${deleteTarget.name}" will be permanently deleted. Are you sure?`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => deleteTarget.type === 'dept' ? deleteDept(deleteTarget.id) : deleteSub(deleteTarget.deptId!, deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Lit Delete Confirm ── */}
      {deleteLitTarget && (
        <ConfirmDialog
          open
          title="Delete Litigation"
          description={`"${deleteLitTarget.student_name}" litigation case will be permanently deleted.`}
          confirmLabel="Delete"
          destructive
          onConfirm={deleteLitigation}
          onCancel={() => setDeleteLitTarget(null)}
        />
      )}
    </div>
  )
}

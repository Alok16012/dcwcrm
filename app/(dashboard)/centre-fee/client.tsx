'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Search, Filter, Building2, IndianRupee, CheckCircle2, Clock,
  AlertCircle, ChevronDown, ChevronUp, Plus, Printer, RefreshCw,
  User, CreditCard, Banknote, FileText, X, Eye, TrendingDown,
} from 'lucide-react'

const fmt = (n: number | null | undefined) =>
  n == null ? '₹0' : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const STATUS_CFG = {
  paid:    { label: 'Paid',    color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-800 border-amber-200',       dot: 'bg-amber-500'   },
  pending: { label: 'Pending', color: 'bg-red-100 text-red-800 border-red-200',             dot: 'bg-red-500'     },
  none:    { label: 'Not Set', color: 'bg-gray-100 text-gray-600 border-gray-200',          dot: 'bg-gray-400'    },
}

const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'demand_draft', 'other']

interface Student {
  id: string
  full_name: string
  enrollment_number: string
  phone: string
  university_name: string | null
  board_name: string | null
  course: { name: string } | null
  department: { name: string } | null
  sub_section: { name: string } | null
  session: { name: string } | null
}

interface CentreFeeRecord {
  id: string
  student_id: string
  centre_fee: number | null
  amount_paid: number
  payment_status: string
  last_payment_date: string | null
  payment_mode: string | null
  transaction_id: string | null
  remarks: string | null
  paid_to_board_name: string | null
  paid_to_person_name: string | null
  account_holder_name: string | null
  bank_name: string | null
  upi_id: string | null
  account_number: string | null
  payment_contact: string | null
}

interface PaymentHistory {
  id: string
  amount: number
  payment_date: string
  payment_mode: string | null
  transaction_id: string | null
  paid_to: string | null
  remarks: string | null
  created_at: string
}

interface Row {
  student: Student
  record: CentreFeeRecord | null
}

// ── Invoice component (printed via window.print) ─────────────────────────────
function InvoiceView({ student, record, payments, onClose }: {
  student: Student; record: CentreFeeRecord; payments: PaymentHistory[]; onClose: () => void
}) {
  const due = (record.centre_fee ?? 0) - record.amount_paid
  const boardName = record.paid_to_board_name || student.department?.name || student.board_name || '—'
  return (
    <div>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h3 className="font-bold text-gray-900">Centre Fee Receipt</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
      </div>

      <div id="invoice-print" className="bg-white border border-gray-200 rounded-xl p-6 text-sm font-sans">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Distance Courses Wala</h1>
              <p className="text-gray-500 text-xs mt-0.5">Centre Fee Payment Receipt</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              <p className="text-xs text-gray-500 mt-0.5">Receipt #{record.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Student Details */}
        <div className="grid grid-cols-2 gap-6 mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Student Details</p>
            <table className="w-full text-xs">
              <tbody>
                <tr><td className="text-gray-500 py-0.5 pr-3">Name</td><td className="font-semibold text-gray-900">{student.full_name}</td></tr>
                <tr><td className="text-gray-500 py-0.5 pr-3">Enrollment</td><td className="font-mono font-semibold">{student.enrollment_number}</td></tr>
                <tr><td className="text-gray-500 py-0.5 pr-3">Course</td><td className="font-semibold">{student.course?.name ?? '—'}</td></tr>
                <tr><td className="text-gray-500 py-0.5 pr-3">Session</td><td className="font-semibold">{student.session?.name ?? '—'}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Paid To</p>
            <table className="w-full text-xs">
              <tbody>
                <tr><td className="text-gray-500 py-0.5 pr-3">Board/University</td><td className="font-semibold text-gray-900">{boardName}</td></tr>
                {record.paid_to_person_name && <tr><td className="text-gray-500 py-0.5 pr-3">Person</td><td className="font-semibold">{record.paid_to_person_name}</td></tr>}
                {record.account_holder_name && <tr><td className="text-gray-500 py-0.5 pr-3">A/C Holder</td><td className="font-semibold">{record.account_holder_name}</td></tr>}
                {record.bank_name && <tr><td className="text-gray-500 py-0.5 pr-3">Bank</td><td className="font-semibold">{record.bank_name}</td></tr>}
                {record.upi_id && <tr><td className="text-gray-500 py-0.5 pr-3">UPI</td><td className="font-mono text-xs">{record.upi_id}</td></tr>}
                {record.account_number && <tr><td className="text-gray-500 py-0.5 pr-3">A/C No</td><td className="font-mono text-xs">{record.account_number}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-gray-50 rounded-xl p-4 mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Payment Summary</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-lg font-extrabold text-gray-900">{fmt(record.centre_fee)}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Total Centre Fee</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold text-emerald-700">{fmt(record.amount_paid)}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Amount Paid</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-extrabold ${due > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(due)}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Due Amount</p>
            </div>
          </div>
        </div>

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Payment History</p>
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600 font-semibold">#</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-semibold">Date</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-semibold">Amount</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-semibold">Mode</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-semibold">Txn ID</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-semibold">Paid To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p, i) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-3 py-2">{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-700">{fmt(p.amount)}</td>
                    <td className="px-3 py-2 capitalize">{p.payment_mode?.replace(/_/g, ' ') ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{p.transaction_id ?? '—'}</td>
                    <td className="px-3 py-2">{p.paid_to ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {record.remarks && (
          <div className="border-t pt-3 mt-3">
            <p className="text-xs text-gray-500"><span className="font-semibold">Remarks:</span> {record.remarks}</p>
          </div>
        )}

        <div className="border-t mt-4 pt-3 text-center text-[10px] text-gray-400">
          Generated by Distance Courses Wala CRM · Powered by Blinks AI
        </div>
      </div>
    </div>
  )
}

// ── Main Client ───────────────────────────────────────────────────────────────
export default function CentreFeeClient() {
  const supabase = createClient()
  const db = supabase as any

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterBoard, setFilterBoard] = useState('')

  // Selected record state
  const [selected, setSelected] = useState<Row | null>(null)
  const [payments, setPayments] = useState<PaymentHistory[]>([])
  const [dialogMode, setDialogMode] = useState<'edit' | 'payment' | 'invoice'>('edit')
  const [dialogOpen, setDialogOpen] = useState(false)

  // Edit form
  const [editForm, setEditForm] = useState({
    centre_fee: '', paid_to_board_name: '', paid_to_person_name: '',
    account_holder_name: '', bank_name: '', upi_id: '', account_number: '',
    payment_contact: '', remarks: '',
  })

  // Payment form
  const [payForm, setPayForm] = useState({
    amount: '', payment_date: new Date().toISOString().slice(0, 10),
    payment_mode: 'cash', transaction_id: '', paid_to: '', remarks: '',
  })

  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: students } = await db.from('students').select(`
      id, full_name, enrollment_number, phone, university_name, board_name,
      course:courses(name), department:departments(name),
      sub_section:department_sub_sections(name), session:sessions(name)
    `).order('full_name')

    const { data: records } = await db.from('centre_fee_records').select('*')

    const recordMap: Record<string, CentreFeeRecord> = {}
    ;(records ?? []).forEach((r: CentreFeeRecord) => { recordMap[r.student_id] = r })

    setRows((students ?? []).map((s: Student) => ({ student: s, record: recordMap[s.id] ?? null })))
    setLoading(false)
  }, [db])

  useEffect(() => { load() }, [load])

  const boards = [...new Set(rows.map(r =>
    r.record?.paid_to_board_name || r.student.department?.name || r.student.board_name || ''
  ).filter(Boolean))].sort()

  const filtered = rows.filter(r => {
    const name = r.student.full_name.toLowerCase()
    const enr  = r.student.enrollment_number.toLowerCase()
    const board = (r.record?.paid_to_board_name || r.student.department?.name || r.student.board_name || '').toLowerCase()
    const s = search.toLowerCase()
    const matchSearch = !search || name.includes(s) || enr.includes(s) || board.includes(s)
    const status = r.record?.payment_status ?? 'none'
    const matchStatus = !filterStatus || status === filterStatus
    const matchBoard = !filterBoard || board.toLowerCase().includes(filterBoard.toLowerCase())
    return matchSearch && matchStatus && matchBoard
  })

  // Dashboard totals
  const totalFee   = rows.reduce((s, r) => s + (r.record?.centre_fee ?? 0), 0)
  const totalPaid  = rows.reduce((s, r) => s + (r.record?.amount_paid ?? 0), 0)
  const totalDue   = totalFee - totalPaid
  const countPaid  = rows.filter(r => r.record?.payment_status === 'paid').length
  const countPartial = rows.filter(r => r.record?.payment_status === 'partial').length
  const countPending = rows.filter(r => !r.record || r.record.payment_status === 'pending').length

  // Board-wise summary
  const boardSummary = rows.reduce((acc, r) => {
    const board = r.record?.paid_to_board_name || r.student.department?.name || r.student.board_name || 'Unassigned'
    if (!acc[board]) acc[board] = { fee: 0, paid: 0, count: 0 }
    acc[board].fee  += r.record?.centre_fee ?? 0
    acc[board].paid += r.record?.amount_paid ?? 0
    acc[board].count++
    return acc
  }, {} as Record<string, { fee: number; paid: number; count: number }>)

  async function openRecord(row: Row) {
    setSelected(row)
    setDialogMode('edit')
    setEditForm({
      centre_fee: row.record?.centre_fee?.toString() ?? '',
      paid_to_board_name:   row.record?.paid_to_board_name ?? '',
      paid_to_person_name:  row.record?.paid_to_person_name ?? '',
      account_holder_name:  row.record?.account_holder_name ?? '',
      bank_name:            row.record?.bank_name ?? '',
      upi_id:               row.record?.upi_id ?? '',
      account_number:       row.record?.account_number ?? '',
      payment_contact:      row.record?.payment_contact ?? '',
      remarks:              row.record?.remarks ?? '',
    })
    if (row.record) {
      const { data } = await db.from('centre_fee_payments')
        .select('*').eq('record_id', row.record.id).order('payment_date', { ascending: false })
      setPayments((data ?? []) as PaymentHistory[])
    } else {
      setPayments([])
    }
    setDialogOpen(true)
  }

  async function saveRecord() {
    if (!selected) return
    if (!editForm.centre_fee || isNaN(Number(editForm.centre_fee))) {
      toast.error('Enter a valid centre fee amount'); return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        student_id: selected.student.id,
        centre_fee: Number(editForm.centre_fee),
        paid_to_board_name:  editForm.paid_to_board_name || null,
        paid_to_person_name: editForm.paid_to_person_name || null,
        account_holder_name: editForm.account_holder_name || null,
        bank_name:           editForm.bank_name || null,
        upi_id:              editForm.upi_id || null,
        account_number:      editForm.account_number || null,
        payment_contact:     editForm.payment_contact || null,
        remarks:             editForm.remarks || null,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }

      if (selected.record) {
        const { error } = await db.from('centre_fee_records').update(payload).eq('id', selected.record.id)
        if (error) { toast.error(error.message); return }
      } else {
        const { error } = await db.from('centre_fee_records').insert({ ...payload, created_by: user?.id })
        if (error) { toast.error(error.message); return }
      }
      toast.success('Saved successfully')
      setDialogOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function addPayment() {
    if (!selected?.record) { toast.error('Save the centre fee record first'); return }
    if (!payForm.amount || isNaN(Number(payForm.amount)) || Number(payForm.amount) <= 0) {
      toast.error('Enter a valid payment amount'); return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await db.from('centre_fee_payments').insert({
        record_id:    selected.record.id,
        amount:       Number(payForm.amount),
        payment_date: payForm.payment_date,
        payment_mode: payForm.payment_mode || null,
        transaction_id: payForm.transaction_id || null,
        paid_to:      payForm.paid_to || null,
        remarks:      payForm.remarks || null,
        created_by:   user?.id,
      })
      if (error) { toast.error(error.message); return }
      toast.success('Payment recorded')
      setPayForm({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_mode: 'cash', transaction_id: '', paid_to: '', remarks: '' })
      // Reload record and payments
      const { data: updatedRecord } = await db.from('centre_fee_records').select('*').eq('id', selected.record.id).single()
      const { data: updatedPayments } = await db.from('centre_fee_payments').select('*').eq('record_id', selected.record.id).order('payment_date', { ascending: false })
      const updatedRow: Row = { student: selected.student, record: updatedRecord }
      setSelected(updatedRow)
      setPayments((updatedPayments ?? []) as PaymentHistory[])
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Centre Fee</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track payments made to boards & universities</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Dashboard Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Total Payable"  value={fmt(totalFee)}         color="blue"    icon={IndianRupee} />
        <SummaryCard label="Total Paid"     value={fmt(totalPaid)}        color="emerald" icon={CheckCircle2} />
        <SummaryCard label="Total Due"      value={fmt(totalDue)}         color="red"     icon={TrendingDown} />
        <SummaryCard label="Fully Paid"     value={countPaid.toString()}  color="emerald" icon={CheckCircle2} />
        <SummaryCard label="Partial"        value={countPartial.toString()}color="amber"  icon={AlertCircle} />
        <SummaryCard label="Pending"        value={countPending.toString()}color="red"    icon={Clock} />
      </div>

      {/* Board-wise Summary */}
      {Object.keys(boardSummary).length > 1 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Board / University Summary</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(boardSummary).slice(0, 9).map(([board, data]) => (
              <div key={board} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">{board}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{data.count} student{data.count !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-bold text-emerald-700">{fmt(data.paid)}</p>
                  <p className="text-[10px] text-red-500 font-medium">{fmt(data.fee - data.paid)} due</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search name, enrollment, board…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          {[
            { key: '', label: `All (${rows.length})` },
            { key: 'paid',    label: `Paid (${countPaid})` },
            { key: 'partial', label: `Partial (${countPartial})` },
            { key: 'pending', label: `Pending (${countPending})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterStatus === f.key ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {boards.length > 0 && (
          <select
            value={filterBoard} onChange={e => setFilterBoard(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 bg-white"
          >
            <option value="">All Boards</option>
            {boards.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
      </div>

      {/* Student List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Student</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs hidden md:table-cell">Board / University</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs hidden lg:table-cell">Course</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs">Centre Fee</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs hidden sm:table-cell">Paid</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs hidden sm:table-cell">Due</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">No records found</td></tr>
              ) : filtered.map(row => {
                const st = STATUS_CFG[row.record?.payment_status as keyof typeof STATUS_CFG ?? 'none']
                const due = (row.record?.centre_fee ?? 0) - (row.record?.amount_paid ?? 0)
                const board = row.record?.paid_to_board_name || row.student.department?.name || row.student.board_name || '—'
                return (
                  <tr key={row.student.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{row.student.full_name}</p>
                      <p className="text-xs font-mono text-gray-400">{row.student.enrollment_number}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell max-w-[160px] truncate">{board}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{row.student.course?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                      {row.record?.centre_fee != null ? fmt(row.record.centre_fee) : <span className="text-gray-300 font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold hidden sm:table-cell">
                      {row.record ? fmt(row.record.amount_paid) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold hidden sm:table-cell ${due > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {row.record ? fmt(due) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${st.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openRecord(row)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> {row.record ? 'Edit' : 'Setup'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={3} className="px-4 py-2.5 text-xs font-bold text-gray-500">{filtered.length} students</td>
                <td className="px-4 py-2.5 text-right font-bold font-mono text-gray-900 text-xs">{fmt(filtered.reduce((s, r) => s + (r.record?.centre_fee ?? 0), 0))}</td>
                <td className="px-4 py-2.5 text-right font-bold font-mono text-emerald-700 text-xs hidden sm:table-cell">{fmt(filtered.reduce((s, r) => s + (r.record?.amount_paid ?? 0), 0))}</td>
                <td className="px-4 py-2.5 text-right font-bold font-mono text-red-600 text-xs hidden sm:table-cell">
                  {fmt(filtered.reduce((s, r) => s + ((r.record?.centre_fee ?? 0) - (r.record?.amount_paid ?? 0)), 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && dialogMode === 'invoice' && selected.record ? (
            <InvoiceView
              student={selected.student}
              record={selected.record}
              payments={payments}
              onClose={() => setDialogMode('edit')}
            />
          ) : selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  {selected.record ? 'Centre Fee Record' : 'Setup Centre Fee'}
                </DialogTitle>
              </DialogHeader>

              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
                {[
                  { key: 'edit', label: 'Fee Details' },
                  { key: 'payment', label: `Payments (${payments.length})` },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setDialogMode(tab.key as any)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${dialogMode === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Auto-fetched student info */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Auto-fetched Student Info</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <InfoPill label="Name"       value={selected.student.full_name} />
                  <InfoPill label="Enrollment" value={selected.student.enrollment_number} mono />
                  <InfoPill label="Course"     value={selected.student.course?.name ?? '—'} />
                  <InfoPill label="Board"      value={selected.student.department?.name ?? selected.student.board_name ?? '—'} />
                  <InfoPill label="University" value={selected.student.sub_section?.name ?? selected.student.university_name ?? '—'} />
                  <InfoPill label="Session"    value={selected.student.session?.name ?? '—'} />
                </div>
              </div>

              {/* Fee Details Tab */}
              {dialogMode === 'edit' && (
                <div className="space-y-4">
                  {/* Centre Fee Amount */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Centre Fee Amount (₹) *</Label>
                    <Input
                      type="number" min="0" placeholder="Enter amount payable to board"
                      value={editForm.centre_fee}
                      onChange={e => setEditForm(f => ({ ...f, centre_fee: e.target.value }))}
                      className="text-lg font-bold"
                    />
                    {selected.record && (
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        <div className="bg-gray-50 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-400">Payable</p>
                          <p className="text-sm font-bold text-gray-900">{fmt(selected.record.centre_fee)}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-emerald-600">Paid</p>
                          <p className="text-sm font-bold text-emerald-700">{fmt(selected.record.amount_paid)}</p>
                        </div>
                        <div className={`rounded-lg p-2 text-center ${(selected.record.centre_fee ?? 0) - selected.record.amount_paid > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                          <p className={`text-[10px] ${(selected.record.centre_fee ?? 0) - selected.record.amount_paid > 0 ? 'text-red-500' : 'text-emerald-600'}`}>Due</p>
                          <p className={`text-sm font-bold ${(selected.record.centre_fee ?? 0) - selected.record.amount_paid > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {fmt((selected.record.centre_fee ?? 0) - selected.record.amount_paid)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Paid To Section */}
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <User className="w-3.5 h-3.5" /> Paid To Details
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs">Board / University Name</Label>
                        <Input placeholder="e.g. NIOS, Open School" value={editForm.paid_to_board_name}
                          onChange={e => setEditForm(f => ({ ...f, paid_to_board_name: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Individual Person Name</Label>
                        <Input placeholder="If paid to a person" value={editForm.paid_to_person_name}
                          onChange={e => setEditForm(f => ({ ...f, paid_to_person_name: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Account Holder Name</Label>
                        <Input value={editForm.account_holder_name}
                          onChange={e => setEditForm(f => ({ ...f, account_holder_name: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Bank Name</Label>
                        <Input placeholder="e.g. SBI, HDFC" value={editForm.bank_name}
                          onChange={e => setEditForm(f => ({ ...f, bank_name: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">UPI ID</Label>
                        <Input placeholder="e.g. name@upi" value={editForm.upi_id}
                          onChange={e => setEditForm(f => ({ ...f, upi_id: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Account Number</Label>
                        <Input placeholder="Bank account number" value={editForm.account_number}
                          onChange={e => setEditForm(f => ({ ...f, account_number: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Payment Contact</Label>
                        <Input placeholder="Phone / email" value={editForm.payment_contact}
                          onChange={e => setEditForm(f => ({ ...f, payment_contact: e.target.value }))} />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs">Remarks</Label>
                        <textarea
                          className="w-full min-h-[60px] rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
                          placeholder="Any notes or remarks…"
                          value={editForm.remarks}
                          onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    {selected.record && (
                      <Button variant="outline" className="gap-2" onClick={() => setDialogMode('invoice')}>
                        <Printer className="w-4 h-4" /> Invoice
                      </Button>
                    )}
                    <Button className="flex-1" onClick={saveRecord} disabled={saving}>
                      {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Record'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Payments Tab */}
              {dialogMode === 'payment' && (
                <div className="space-y-4">
                  {!selected.record && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                      Save the centre fee record first before adding payments.
                    </div>
                  )}

                  {/* Add payment form */}
                  {selected.record && (
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5" /> Record New Payment
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Amount (₹) *</Label>
                          <Input type="number" min="1" placeholder="Payment amount"
                            value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Payment Date *</Label>
                          <Input type="date" value={payForm.payment_date}
                            onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Payment Mode</Label>
                          <select value={payForm.payment_mode} onChange={e => setPayForm(f => ({ ...f, payment_mode: e.target.value }))}
                            className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm">
                            {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Transaction ID</Label>
                          <Input placeholder="UTR / Ref No" value={payForm.transaction_id}
                            onChange={e => setPayForm(f => ({ ...f, transaction_id: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Paid To</Label>
                          <Input placeholder="Board / person name" value={payForm.paid_to}
                            onChange={e => setPayForm(f => ({ ...f, paid_to: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Remarks</Label>
                          <Input placeholder="Optional note" value={payForm.remarks}
                            onChange={e => setPayForm(f => ({ ...f, remarks: e.target.value }))} />
                        </div>
                      </div>
                      <Button className="w-full gap-2" onClick={addPayment} disabled={saving}>
                        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus className="w-4 h-4" /> Record Payment</>}
                      </Button>
                    </div>
                  )}

                  {/* Payment history */}
                  {payments.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No payments recorded yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Payment History</p>
                      {payments.map((p, i) => (
                        <div key={p.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-emerald-700">{fmt(p.amount)}</p>
                              {p.payment_mode && (
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium capitalize">
                                  {p.payment_mode.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                              <span>{new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              {p.transaction_id && <span className="font-mono">#{p.transaction_id}</span>}
                              {p.paid_to && <span>→ {p.paid_to}</span>}
                            </div>
                            {p.remarks && <p className="text-xs text-gray-400 mt-0.5 italic">{p.remarks}</p>}
                          </div>
                          <span className="text-[10px] text-gray-300 shrink-0">{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body > * { display: none !important; }
          #invoice-print { display: block !important; }
          #invoice-print { position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  )
}

function SummaryCard({ label, value, color, icon: Icon }: {
  label: string; value: string; color: 'blue' | 'emerald' | 'red' | 'amber'; icon: any
}) {
  const c = {
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    emerald:'bg-emerald-50 border-emerald-100 text-emerald-700',
    red:    'bg-red-50 border-red-100 text-red-700',
    amber:  'bg-amber-50 border-amber-100 text-amber-700',
  }[color]
  return (
    <div className={`${c} border rounded-2xl p-4`}>
      <div className="flex items-center gap-1.5 mb-2 opacity-70">
        <Icon className="w-3.5 h-3.5" />
        <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-lg font-extrabold">{value}</p>
    </div>
  )
}

function InfoPill({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] text-blue-500 font-bold uppercase tracking-wide">{label}</p>
      <p className={`text-xs font-semibold text-blue-900 mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

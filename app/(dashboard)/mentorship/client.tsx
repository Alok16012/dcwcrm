'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  GraduationCap, BookOpen, ClipboardList, Star, CheckCircle2,
  Clock, XCircle, ChevronDown, ChevronUp, RefreshCw,
  FileText, Award, Truck, LayoutList, ClipboardCheck,
  Upload, X, IndianRupee, BookMarked, Phone, Users, TrendingUp, Search,
  Eye,
} from 'lucide-react'
import { format } from 'date-fns'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { StudentLifecycle, lifecycleProgress } from '@/components/shared/StudentLifecycle'

interface AssignedStudent {
  id: string
  full_name: string
  enrollment_number: string | null
  phone: string
  email: string | null
  father_name: string | null
  city: string | null
  course: { name: string } | null
  sub_course: { name: string } | null
  department: { name: string } | null
  sub_section: { name: string } | null
  session: { name: string } | null
  verification_status: string
  exam_status: string
  result_status: string
  admit_card_url: string | null
  portal_active: boolean
  total_fee: number | null
  amount_paid: number | null
}

interface MentorRecord {
  id: string
  task_type: string
  subject_name: string | null
  total_amount: number | null
  student_paid_amount: number | null
  screenshot_url: string | null
  status: string
  admin_remarks: string | null
  salary_percentage: number | null
  created_at: string
}

const RECORD_TYPES = [
  { value: 'practical',  label: 'Practical',  color: 'emerald' },
  { value: 'assignment', label: 'Assignment', color: 'blue' },
  { value: 'theory',     label: 'Theory',     color: 'purple' },
] as const

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  pending:  { label: 'Pending',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  icon: Clock },
  approved: { label: 'Approved', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', bg: 'bg-red-50',      text: 'text-red-600',     border: 'border-red-200',    icon: XCircle },
}

const TYPE_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  practical:  { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  assignment: { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500' },
  theory:     { bg: 'bg-purple-100',  text: 'text-purple-800',  dot: 'bg-purple-500' },
}


function fmtEnroll(n: string | null | undefined) {
  if (!n) return '—'
  if (n.startsWith('ENR-')) return 'DCW-' + n.slice(4).replace(/[^0-9]/g, '')
  return n
}

const BOARD_BADGE: Record<string, string> = {
  NIOS:  'bg-blue-100 text-blue-800 border-blue-200',
  BOSSE: 'bg-violet-100 text-violet-800 border-violet-200',
  BBOSE: 'bg-violet-100 text-violet-800 border-violet-200',
}
function boardBadge(name: string) {
  const u = name.toUpperCase()
  for (const k of Object.keys(BOARD_BADGE)) if (u.includes(k)) return BOARD_BADGE[k]
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

const AVATAR_PALETTES = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-indigo-500 to-blue-600',
]
function avatarPalette(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length]
}

export default function MentorshipClient() {
  const [students, setStudents] = useState<AssignedStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [boardFilter, setBoardFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [history, setHistory] = useState<Record<string, MentorRecord[]>>({})
  const [detailStudent, setDetailStudent] = useState<AssignedStudent | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [showAdd, setShowAdd] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [formType, setFormType] = useState<string>('practical')
  const [formSubject, setFormSubject] = useState('')
  const [formTotal, setFormTotal] = useState('')
  const [formPaid, setFormPaid] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await (supabase as any)
        .from('students')
        .select(`
          id, full_name, enrollment_number, phone, email, father_name, city,
          verification_status, exam_status, result_status,
          admit_card_url, portal_active, total_fee, amount_paid,
          course:courses(name),
          sub_course:sub_courses(name),
          department:departments(name),
          sub_section:department_sub_sections(name),
          session:sessions(name)
        `)
        .eq('mentor_telecaller_id', user.id)
        .order('full_name')
      if (error) throw error
      setStudents((data ?? []) as AssignedStudent[])
    } catch {
      toast.error('Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function openDetail(s: AssignedStudent) {
    setDetailStudent(s)
    if (history[s.id]) return
    setDetailLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await (supabase as any)
      .from('student_mentorships')
      .select('id, task_type, subject_name, total_amount, student_paid_amount, screenshot_url, status, admin_remarks, salary_percentage, created_at')
      .eq('student_id', s.id)
      .eq('telecaller_id', user.id)
      .order('created_at', { ascending: false })
    setHistory(prev => ({ ...prev, [s.id]: (data ?? []) as MentorRecord[] }))
    setDetailLoading(false)
  }

  async function loadHistory(studentId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await (supabase as any)
      .from('student_mentorships')
      .select('id, task_type, subject_name, total_amount, student_paid_amount, screenshot_url, status, admin_remarks, salary_percentage, created_at')
      .eq('student_id', studentId)
      .eq('telecaller_id', user.id)
      .order('created_at', { ascending: false })
    setHistory(prev => ({ ...prev, [studentId]: (data ?? []) as MentorRecord[] }))
  }

  function openAddRecord(studentId: string) {
    setFormType('practical')
    setFormSubject('')
    setFormTotal('')
    setFormPaid('')
    setFormFile(null)
    setShowAdd(studentId)
  }

  async function submitRecord() {
    if (!showAdd) return
    if (!formSubject.trim()) { toast.error('Subject name is required'); return }
    if (!formTotal) { toast.error('Total amount is required'); return }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      let screenshotUrl: string | null = null
      if (formFile) {
        const ext = formFile.name.split('.').pop()
        const path = `mentorship/${user.id}/${showAdd}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('student-documents').upload(path, formFile, { upsert: true })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('student-documents').getPublicUrl(path)
        screenshotUrl = urlData.publicUrl
      }
      const { error } = await (supabase as any).from('student_mentorships').insert({
        student_id: showAdd,
        telecaller_id: user.id,
        created_by: user.id,
        task_type: formType,
        subject_name: formSubject.trim(),
        total_amount: parseFloat(formTotal) || null,
        student_paid_amount: formPaid ? parseFloat(formPaid) : null,
        screenshot_url: screenshotUrl,
        status: 'pending',
      })
      if (error) throw error
      toast.success('Record submitted for approval')
      setShowAdd(null)
      loadHistory(showAdd)
      if (detailStudent?.id === showAdd) {
        loadHistory(showAdd)
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to submit record')
    } finally {
      setSubmitting(false)
    }
  }

  const boards = ['all', ...Array.from(new Set(students.map(s => s.sub_section?.name).filter(Boolean) as string[]))]

  const filtered = students
    .filter(s => boardFilter === 'all' || s.sub_section?.name === boardFilter)
    .filter(s => !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search) || fmtEnroll(s.enrollment_number).toLowerCase().includes(search.toLowerCase()))

  const totalPending = Object.values(history).flat().filter(r => r.status === 'pending').length
  const totalRecords = Object.values(history).flat().length

  const detailRecords = detailStudent ? (history[detailStudent.id] ?? []) : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Award className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Mentorship</h1>
            </div>
            <p className="text-violet-200 text-sm mt-1">Manage your assigned students and track their progress</p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <div className="relative grid grid-cols-3 gap-3 mt-5">
          {[
            { icon: Users,      label: 'Assigned',       value: students.length },
            { icon: TrendingUp, label: 'Total Records',  value: totalRecords },
            { icon: Clock,      label: 'Pending Review', value: totalPending },
          ].map(stat => (
            <div key={stat.label} className="bg-white/15 rounded-xl px-3 py-3 backdrop-blur-sm">
              <stat.icon className="w-4 h-4 text-white/70 mb-1" />
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-[11px] text-white/70 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Board tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {boards.map(b => {
            const count = b === 'all' ? students.length : students.filter(s => s.sub_section?.name === b).length
            return (
              <button
                key={b}
                onClick={() => setBoardFilter(b)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  boardFilter === b
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
                }`}
              >
                {b === 'all' ? 'All' : b}
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${boardFilter === b ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 h-8 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-violet-400 w-52"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
          <GraduationCap className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No students found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['S.No', 'Enrollment No', 'Student', "Father's Name", 'Phone', 'City', 'Course', 'Board', 'Session', 'Fee', 'Paid', 'Progress', 'Records', 'Actions'].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s, idx) => {
                  const { lastIdx, pct, total } = lifecycleProgress(s)
                  const palette = avatarPalette(s.full_name)
                  const initials = s.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  const recs = history[s.id] ?? []
                  const pending = recs.filter(r => r.status === 'pending').length
                  const approved = recs.filter(r => r.status === 'approved').length
                  const boardName = s.sub_section?.name ?? ''

                  return (
                    <tr key={s.id} className="hover:bg-violet-50/30 transition-colors group">
                      {/* S.No */}
                      <td className="px-3 py-3 text-gray-400 text-xs tabular-nums font-medium">{idx + 1}</td>

                      {/* Enrollment */}
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg whitespace-nowrap">
                          {fmtEnroll(s.enrollment_number)}
                        </span>
                      </td>

                      {/* Student */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5 min-w-[140px]">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${palette} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm leading-tight whitespace-nowrap">{s.full_name}</p>
                          </div>
                        </div>
                      </td>

                      {/* Father */}
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{s.father_name || '—'}</td>

                      {/* Phone — tap to call */}
                      <td className="px-3 py-3">
                        {s.phone ? (
                          <a
                            href={`tel:${s.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
                          >
                            <Phone className="w-3 h-3" />{s.phone}
                          </a>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>

                      {/* City */}
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{s.city || '—'}</td>

                      {/* Course */}
                      <td className="px-3 py-3">
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">
                          {s.course?.name ?? '—'}
                        </span>
                      </td>

                      {/* Board */}
                      <td className="px-3 py-3">
                        {boardName ? (
                          <span className={`text-xs px-2 py-0.5 rounded-lg font-bold border whitespace-nowrap ${boardBadge(boardName)}`}>
                            {boardName}
                          </span>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>

                      {/* Session */}
                      <td className="px-3 py-3">
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">
                          {s.session?.name ?? '—'}
                        </span>
                      </td>

                      {/* Fee */}
                      <td className="px-3 py-3 text-xs font-semibold text-gray-700 whitespace-nowrap tabular-nums">
                        {s.total_fee ? `₹${Number(s.total_fee).toLocaleString('en-IN')}` : '—'}
                      </td>

                      {/* Paid */}
                      <td className="px-3 py-3 text-xs font-semibold text-emerald-600 whitespace-nowrap tabular-nums">
                        {s.amount_paid ? `₹${Number(s.amount_paid).toLocaleString('en-IN')}` : '—'}
                      </td>

                      {/* Progress */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1 min-w-[80px]">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500">{pct}%</span>
                            <span className="text-[10px] text-gray-400">{lastIdx + 1}/{total}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Records */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 flex-wrap min-w-[70px]">
                          {approved > 0 && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                              ✓{approved}
                            </span>
                          )}
                          {pending > 0 && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                              ⏳{pending}
                            </span>
                          )}
                          {recs.length === 0 && <span className="text-xs text-gray-400">—</span>}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => openAddRecord(s.id)}
                            className="h-7 px-2.5 text-[11px] bg-violet-600 hover:bg-violet-700 text-white gap-1"
                          >
                            <BookMarked className="w-3 h-3" /> Add
                          </Button>
                          <button
                            onClick={() => openDetail(s)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 font-medium">
            {filtered.length} student{filtered.length !== 1 ? 's' : ''} {boardFilter !== 'all' ? `· ${boardFilter}` : ''}
          </div>
        </div>
      )}

      {/* Detail Modal — lifecycle + history */}
      <Dialog open={!!detailStudent} onOpenChange={open => !open && setDetailStudent(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailStudent && (() => {
            const palette = avatarPalette(detailStudent.full_name)
            const initials = detailStudent.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            const recs = detailRecords

            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${palette} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                        {initials}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{detailStudent.full_name}</p>
                        <p className="text-xs text-gray-400 font-normal">{fmtEnroll(detailStudent.enrollment_number)} · {detailStudent.phone}</p>
                      </div>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                  {/* Lifecycle (shared, admin-driven) */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <StudentLifecycle student={detailStudent} title="Student Progress" />
                  </div>

                  {/* Add record */}
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => { openAddRecord(detailStudent.id); setDetailStudent(null) }}
                      className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 h-8"
                    >
                      <BookMarked className="w-3.5 h-3.5" /> Add Record
                    </Button>
                  </div>

                  {/* Records */}
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : recs.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                      <BookMarked className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-400">No records submitted yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Submission History ({recs.length})</p>
                      {recs.map(r => {
                        const sc = STATUS_CFG[r.status] ?? STATUS_CFG.pending
                        const SIcon = sc.icon
                        const tb = TYPE_BADGE[r.task_type] ?? TYPE_BADGE.assignment
                        const tl = RECORD_TYPES.find(t => t.value === r.task_type)?.label ?? r.task_type
                        return (
                          <div key={r.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-start gap-3 shadow-sm">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${tb.bg} ${tb.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${tb.dot}`} />{tl}
                                </span>
                                {r.subject_name && <span className="text-sm font-semibold text-gray-800">{r.subject_name}</span>}
                              </div>
                              <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
                                {r.total_amount != null && <span>Total: ₹{r.total_amount}</span>}
                                {r.student_paid_amount != null && <span className="text-emerald-600 font-semibold">Paid: ₹{r.student_paid_amount}</span>}
                                {r.status === 'approved' && r.salary_percentage != null && <span className="text-violet-600 font-semibold">+{r.salary_percentage}% bonus</span>}
                                <span>{format(new Date(r.created_at), 'dd MMM yyyy')}</span>
                              </div>
                              {r.admin_remarks && <p className="text-xs text-gray-400 italic mt-1">"{r.admin_remarks}"</p>}
                              {r.screenshot_url && (
                                <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 flex items-center gap-1">
                                  <FileText className="w-3 h-3" /> View Screenshot
                                </a>
                              )}
                            </div>
                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border flex-shrink-0 ${sc.bg} ${sc.text} ${sc.border}`}>
                              <SIcon className="w-3 h-3" /> {sc.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Add Record Modal */}
      <Dialog open={!!showAdd} onOpenChange={open => !open && setShowAdd(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                <BookMarked className="w-4 h-4 text-violet-600" />
              </div>
              Add Mentorship Record
              {showAdd && (
                <span className="text-sm font-normal text-gray-500 ml-1">
                  — {students.find(s => s.id === showAdd)?.full_name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="grid grid-cols-3 gap-2">
              {RECORD_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setFormType(t.value)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                    formType === t.value
                      ? t.color === 'emerald' ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                      : t.color === 'blue' ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                      : 'bg-purple-500 text-white border-purple-500 shadow-md'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Subject Name <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. Mathematics, English..." value={formSubject} onChange={e => setFormSubject(e.target.value)} className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Total Amount (₹) <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                  <Input type="number" placeholder="100" value={formTotal} onChange={e => setFormTotal(e.target.value)} className="h-10 pl-7" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Student Paid (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                  <Input type="number" placeholder="20" value={formPaid} onChange={e => setFormPaid(e.target.value)} className="h-10 pl-7" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Screenshot / Proof</Label>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setFormFile(e.target.files?.[0] ?? null)} />
              {formFile ? (
                <div className="flex items-center gap-3 bg-violet-50 border-2 border-violet-200 rounded-xl px-4 py-3">
                  <FileText className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  <span className="text-sm text-violet-800 font-medium flex-1 truncate">{formFile.name}</span>
                  <button onClick={() => setFormFile(null)}><X className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 hover:border-violet-300 rounded-xl px-4 py-5 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-violet-100 flex items-center justify-center transition-colors">
                    <Upload className="w-5 h-5 text-gray-400 group-hover:text-violet-500 transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-500 group-hover:text-violet-600">Upload screenshot</p>
                    <p className="text-xs text-gray-400 mt-0.5">JPG, PNG or PDF</p>
                  </div>
                </button>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-10" onClick={() => setShowAdd(null)}>Cancel</Button>
              <Button
                className="flex-1 h-10 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md shadow-violet-200"
                onClick={submitRecord}
                disabled={submitting}
              >
                {submitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Submitting...</> : 'Submit for Approval'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

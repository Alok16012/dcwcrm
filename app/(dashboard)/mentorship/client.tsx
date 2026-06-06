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
  Upload, X, IndianRupee, BookMarked, Phone, MapPin,
  Users, TrendingUp,
} from 'lucide-react'
import { format } from 'date-fns'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

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
  pending:  { label: 'Pending',  bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200', icon: Clock },
  approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-200',    icon: XCircle },
}

const TYPE_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  practical:  { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  assignment: { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500' },
  theory:     { bg: 'bg-purple-100',  text: 'text-purple-800',  dot: 'bg-purple-500' },
}

const LIFECYCLE = [
  { key: 'enrolled',         label: 'Enrolled',    icon: LayoutList },
  { key: 'docs_submitted',   label: 'Docs',        icon: FileText },
  { key: 'verified',         label: 'Verified',    icon: CheckCircle2 },
  { key: 'enrolled_gen',     label: 'Enroll ID',   icon: ClipboardCheck },
  { key: 'exam_scheduled',   label: 'Exam',        icon: BookOpen },
  { key: 'hall_ticket',      label: 'Hall Ticket', icon: Award },
  { key: 'result_declared',  label: 'Result',      icon: Star },
  { key: 'dispatched',       label: 'Dispatched',  icon: Truck },
] as const

function getLifecycleDone(s: AssignedStudent) {
  return {
    enrolled:       true,
    docs_submitted: ['in_review', 'verified'].includes(s.verification_status),
    verified:       s.verification_status === 'verified',
    enrolled_gen:   !!s.enrollment_number || s.portal_active,
    exam_scheduled: s.exam_status !== 'not_scheduled',
    hall_ticket:    !!s.admit_card_url,
    result_declared:['declared', 'passed', 'failed'].includes(s.result_status),
    dispatched:     false,
  }
}

function fmtEnroll(n: string | null | undefined) {
  if (!n) return null
  if (n.startsWith('ENR-')) return 'DCW-' + n.slice(4).replace(/[^0-9]/g, '')
  return n
}

const BOARD_COLORS: Record<string, { from: string; to: string; badge: string; text: string }> = {
  NIOS:  { from: 'from-blue-500',   to: 'to-blue-700',   badge: 'bg-blue-100 text-blue-800 border-blue-200',    text: 'text-blue-600' },
  BOSSE: { from: 'from-violet-500', to: 'to-violet-700', badge: 'bg-violet-100 text-violet-800 border-violet-200', text: 'text-violet-600' },
  BBOSE: { from: 'from-violet-500', to: 'to-violet-700', badge: 'bg-violet-100 text-violet-800 border-violet-200', text: 'text-violet-600' },
}

function getBoardColors(name: string) {
  const upper = name.toUpperCase()
  for (const key of Object.keys(BOARD_COLORS)) {
    if (upper.includes(key)) return BOARD_COLORS[key]
  }
  return { from: 'from-gray-500', to: 'to-gray-700', badge: 'bg-gray-100 text-gray-700 border-gray-200', text: 'text-gray-600' }
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [history, setHistory] = useState<Record<string, MentorRecord[]>>({})
  const [histLoading, setHistLoading] = useState<string | null>(null)
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
          id, full_name, enrollment_number, phone, email, city,
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

  async function loadHistory(studentId: string) {
    setHistLoading(studentId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await (supabase as any)
      .from('student_mentorships')
      .select('id, task_type, subject_name, total_amount, student_paid_amount, screenshot_url, status, admin_remarks, salary_percentage, created_at')
      .eq('student_id', studentId)
      .eq('telecaller_id', user.id)
      .order('created_at', { ascending: false })
    setHistory(prev => ({ ...prev, [studentId]: (data ?? []) as MentorRecord[] }))
    setHistLoading(null)
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      loadHistory(id)
    }
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
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to submit record')
    } finally {
      setSubmitting(false)
    }
  }

  const boards = ['all', ...Array.from(new Set(students.map(s => s.sub_section?.name).filter(Boolean) as string[]))]
  const filteredStudents = boardFilter === 'all' ? students : students.filter(s => s.sub_section?.name === boardFilter)

  const totalPending = Object.values(history).flat().filter(r => r.status === 'pending').length
  const totalRecords = Object.values(history).flat().length

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
            <p className="text-violet-200 text-sm mt-1">
              Manage your assigned students and track their progress
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="relative grid grid-cols-3 gap-3 mt-5">
          {[
            { icon: Users,     label: 'Assigned',      value: students.length,    bg: 'bg-white/15' },
            { icon: TrendingUp, label: 'Total Records', value: totalRecords,       bg: 'bg-white/15' },
            { icon: Clock,     label: 'Pending Review', value: totalPending,       bg: 'bg-amber-400/30' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-xl px-3 py-3 backdrop-blur-sm`}>
              <stat.icon className="w-4 h-4 text-white/70 mb-1" />
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-[11px] text-white/70 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Board filter tabs */}
      {boards.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {boards.map(b => {
            const clrs = b !== 'all' ? getBoardColors(b) : null
            const isActive = boardFilter === b
            const count = b === 'all' ? students.length : students.filter(s => s.sub_section?.name === b).length
            return (
              <button
                key={b}
                onClick={() => setBoardFilter(b)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  isActive
                    ? b === 'all'
                      ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                      : `bg-gradient-to-r ${clrs?.from} ${clrs?.to} text-white border-transparent shadow-md`
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {b === 'all' ? 'All Students' : b}
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Student list */}
      {filteredStudents.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-violet-400" />
          </div>
          <p className="font-bold text-gray-600 text-lg">No students assigned</p>
          <p className="text-sm text-gray-400 mt-1">Admin will assign students to you for mentorship</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStudents.map((s, idx) => {
            const isExpanded = expandedId === s.id
            const records = history[s.id] ?? []
            const pendingCount = records.filter(r => r.status === 'pending').length
            const done = getLifecycleDone(s)
            const keys = LIFECYCLE.map(l => l.key)
            const lastIdx = keys.reduce((acc, k, i) => (done as any)[k] ? i : acc, -1)
            const pct = Math.round(((lastIdx + 1) / LIFECYCLE.length) * 100)
            const boardName = s.sub_section?.name ?? ''
            const boardClrs = boardName ? getBoardColors(boardName) : null
            const palette = avatarPalette(s.full_name)
            const initials = s.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            const enrolled = fmtEnroll(s.enrollment_number)

            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all duration-200 ${
                  isExpanded ? 'border-violet-200 shadow-violet-100 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                {/* Collapsed row */}
                <button
                  onClick={() => toggleExpand(s.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                >
                  {/* Serial */}
                  <span className="text-xs font-bold text-gray-300 w-5 flex-shrink-0 tabular-nums">{idx + 1}</span>

                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${palette} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}>
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">{s.full_name}</span>
                      {enrolled && (
                        <span className="font-mono text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">
                          {enrolled}
                        </span>
                      )}
                      {pendingCount > 0 && (
                        <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                          {pendingCount} pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {s.course && <span className="text-xs text-gray-500">{s.course.name}</span>}
                      {boardName && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${boardClrs?.badge}`}>
                          {boardName}
                        </span>
                      )}
                      {s.session && <span className="text-xs text-gray-400">· {s.session.name}</span>}
                      {s.phone && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" />{s.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress pill */}
                  <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs font-bold text-gray-400">{pct}%</span>
                    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400">{records.length} records</span>
                  </div>

                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    isExpanded ? 'bg-violet-100' : 'bg-gray-100'
                  }`}>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-violet-600" />
                      : <ChevronDown className="w-4 h-4 text-gray-500" />
                    }
                  </div>
                </button>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-violet-100 bg-gradient-to-b from-violet-50/40 to-white px-5 py-5 space-y-6">

                    {/* Info grid */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Student Information</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          { label: 'Phone',       value: s.phone,                icon: Phone },
                          { label: 'City',        value: s.city || '—',          icon: MapPin },
                          { label: 'Course',      value: s.course?.name || '—',  icon: BookOpen },
                          { label: 'Board',       value: s.sub_section?.name || '—', icon: Award },
                          { label: 'Sub Course',  value: s.sub_course?.name || '—',  icon: GraduationCap },
                          { label: 'Department',  value: s.department?.name || '—',  icon: ClipboardList },
                          { label: 'Total Fee',   value: s.total_fee ? `₹${Number(s.total_fee).toLocaleString('en-IN')}` : '—', icon: IndianRupee },
                          { label: 'Amount Paid', value: s.amount_paid ? `₹${Number(s.amount_paid).toLocaleString('en-IN')}` : '—', icon: CheckCircle2 },
                        ].map(({ label, value, icon: Icon }) => (
                          <div key={label} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Icon className="w-3 h-3 text-gray-400" />
                              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
                            </div>
                            <p className="text-xs font-bold text-gray-800 truncate">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Lifecycle */}
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" /> Student Progress
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-emerald-600">{pct}%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                        {LIFECYCLE.map((step, i) => {
                          const isDone = (done as any)[step.key]
                          const isCurrent = i === lastIdx + 1
                          const Icon = step.icon
                          return (
                            <div key={step.key} className="flex flex-col items-center gap-1.5 text-center">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${
                                isDone    ? 'bg-emerald-500 shadow-emerald-100' :
                                isCurrent ? 'bg-blue-50 border-2 border-blue-400 border-dashed' :
                                            'bg-gray-50 border border-gray-200'
                              }`}>
                                <Icon className={`w-4 h-4 ${isDone ? 'text-white' : isCurrent ? 'text-blue-500' : 'text-gray-300'}`} />
                              </div>
                              <p className={`text-[9px] font-bold leading-tight ${
                                isDone ? 'text-emerald-600' : isCurrent ? 'text-blue-500' : 'text-gray-300'
                              }`}>
                                {step.label}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {records.length > 0 && (
                          <>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">
                              <ClipboardList className="w-3.5 h-3.5" />
                              {records.length} record{records.length !== 1 ? 's' : ''}
                            </span>
                            {pendingCount > 0 && (
                              <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg font-medium">
                                <Clock className="w-3.5 h-3.5" />
                                {pendingCount} pending
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => openAddRecord(s.id)}
                        className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white gap-2 h-9 px-4 shadow-md shadow-violet-200"
                      >
                        <BookMarked className="w-3.5 h-3.5" />
                        Add Record
                      </Button>
                    </div>

                    {/* History */}
                    {histLoading === s.id ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : records.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" /> Submission History
                        </p>
                        {records.map(r => {
                          const statusCfg = STATUS_CFG[r.status] ?? STATUS_CFG.pending
                          const StatusIcon = statusCfg.icon
                          const typeCfg = TYPE_BADGE[r.task_type] ?? TYPE_BADGE.assignment
                          const typeLabel = RECORD_TYPES.find(t => t.value === r.task_type)?.label ?? r.task_type
                          return (
                            <div key={r.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg ${typeCfg.bg} ${typeCfg.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${typeCfg.dot}`} />
                                    {typeLabel}
                                  </span>
                                  {r.subject_name && (
                                    <span className="text-sm font-semibold text-gray-800">{r.subject_name}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
                                  {r.total_amount != null && (
                                    <span className="flex items-center gap-0.5 font-medium">
                                      <IndianRupee className="w-3 h-3" /> Total: ₹{r.total_amount}
                                    </span>
                                  )}
                                  {r.student_paid_amount != null && (
                                    <span className="text-emerald-600 font-semibold">Paid: ₹{r.student_paid_amount}</span>
                                  )}
                                  {r.status === 'approved' && r.salary_percentage != null && (
                                    <span className="text-violet-600 font-semibold">+{r.salary_percentage}% bonus</span>
                                  )}
                                  <span className="text-gray-400">{format(new Date(r.created_at), 'dd MMM yyyy')}</span>
                                </div>
                                {r.admin_remarks && (
                                  <p className="text-xs text-gray-400 italic mt-1">"{r.admin_remarks}"</p>
                                )}
                                {r.screenshot_url && (
                                  <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-500 hover:text-blue-700 mt-1 flex items-center gap-1 font-medium">
                                    <FileText className="w-3 h-3" /> View Screenshot
                                  </a>
                                )}
                              </div>
                              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border flex-shrink-0 ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                                <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Record Modal */}
      <Dialog open={!!showAdd} onOpenChange={open => !open && setShowAdd(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                <BookMarked className="w-4 h-4 text-violet-600" />
              </div>
              Add Mentorship Record
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            {/* Type selector */}
            <div className="grid grid-cols-3 gap-2">
              {RECORD_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setFormType(t.value)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                    formType === t.value
                      ? t.color === 'emerald' ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-100'
                      : t.color === 'blue' ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-100'
                      : 'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-100'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Subject Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Mathematics, English, Physics..."
                value={formSubject}
                onChange={e => setFormSubject(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Total Amount (₹) <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                  <Input type="number" placeholder="100" value={formTotal} onChange={e => setFormTotal(e.target.value)} className="h-10 pl-7" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Student Paid (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                  <Input type="number" placeholder="20" value={formPaid} onChange={e => setFormPaid(e.target.value)} className="h-10 pl-7" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Screenshot / Proof</Label>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setFormFile(e.target.files?.[0] ?? null)} />
              {formFile ? (
                <div className="flex items-center gap-3 bg-violet-50 border-2 border-violet-200 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-200 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-violet-700" />
                  </div>
                  <span className="text-sm text-violet-800 font-medium flex-1 truncate">{formFile.name}</span>
                  <button onClick={() => setFormFile(null)}>
                    <X className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors" />
                  </button>
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
                    <p className="text-sm font-semibold text-gray-500 group-hover:text-violet-600 transition-colors">Upload screenshot</p>
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
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Submitting...</>
                ) : 'Submit for Approval'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

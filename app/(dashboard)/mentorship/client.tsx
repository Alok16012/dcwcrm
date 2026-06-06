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
  Upload, X, IndianRupee, BookMarked,
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

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:  { label: 'Pending Approval', color: 'bg-amber-100 text-amber-800 border-amber-200',  icon: Clock },
  approved: { label: 'Approved',         color: 'bg-green-100 text-green-800 border-green-200',  icon: CheckCircle2 },
  rejected: { label: 'Rejected',         color: 'bg-red-100 text-red-800 border-red-200',        icon: XCircle },
}

const LIFECYCLE = [
  { key: 'enrolled',         label: 'Enrolled',       icon: LayoutList },
  { key: 'docs_submitted',   label: 'Docs',           icon: FileText },
  { key: 'verified',         label: 'Verified',       icon: CheckCircle2 },
  { key: 'enrolled_gen',     label: 'Enroll ID',      icon: ClipboardCheck },
  { key: 'exam_scheduled',   label: 'Exam',           icon: BookOpen },
  { key: 'hall_ticket',      label: 'Hall Ticket',    icon: Award },
  { key: 'result_declared',  label: 'Result',         icon: Star },
  { key: 'dispatched',       label: 'Dispatched',     icon: Truck },
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

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  emerald: { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  blue:    { bg: 'bg-blue-50',     border: 'border-blue-200',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-800' },
  purple:  { bg: 'bg-purple-50',   border: 'border-purple-200',  text: 'text-purple-700',  badge: 'bg-purple-100 text-purple-800' },
}

export default function MentorshipClient() {
  const [students, setStudents] = useState<AssignedStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [boardFilter, setBoardFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [history, setHistory] = useState<Record<string, MentorRecord[]>>({})
  const [showAdd, setShowAdd] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
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

  // Dynamic board tabs from student data
  const boards = ['all', ...Array.from(new Set(students.map(s => s.sub_section?.name).filter(Boolean) as string[]))]

  const filteredStudents = boardFilter === 'all'
    ? students
    : students.filter(s => s.sub_section?.name === boardFilter)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mentorship</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {students.length} student{students.length !== 1 ? 's' : ''} assigned to you
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Board filter tabs */}
      {boards.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {boards.map(b => (
            <button
              key={b}
              onClick={() => setBoardFilter(b)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                boardFilter === b
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {b === 'all' ? 'All' : b}
              <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${boardFilter === b ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {b === 'all' ? students.length : students.filter(s => s.sub_section?.name === b).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {filteredStudents.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No students assigned</p>
          <p className="text-sm text-gray-400 mt-1">Admin will assign students to you for mentorship</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStudents.map(s => {
            const isExpanded = expandedId === s.id
            const records = history[s.id] ?? []
            const pendingCount = records.filter(r => r.status === 'pending').length
            const done = getLifecycleDone(s)
            const keys = LIFECYCLE.map(l => l.key)
            const lastIdx = keys.reduce((acc, k, i) => (done as any)[k] ? i : acc, -1)
            const pct = Math.round(((lastIdx + 1) / LIFECYCLE.length) * 100)

            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Student row */}
                <button
                  onClick={() => toggleExpand(s.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm flex-shrink-0">
                    {s.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 text-sm">{s.full_name}</p>
                      {fmtEnroll(s.enrollment_number) && (
                        <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {fmtEnroll(s.enrollment_number)}
                        </span>
                      )}
                      {pendingCount > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                          {pendingCount} pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-gray-400">
                      {s.course && <span>{s.course.name}</span>}
                      {s.sub_section && <span>· {s.sub_section.name}</span>}
                      {s.session && <span>· {s.session.name}</span>}
                      <span>· {s.phone}</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-5 space-y-5">

                    {/* Student Info (read-only) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Phone', value: s.phone },
                        { label: 'City', value: s.city || '—' },
                        { label: 'Course', value: s.course?.name || '—' },
                        { label: 'Board', value: s.sub_section?.name || '—' },
                        { label: 'Sub Course', value: s.sub_course?.name || '—' },
                        { label: 'Department', value: s.department?.name || '—' },
                        { label: 'Total Fee', value: s.total_fee ? `₹${Number(s.total_fee).toLocaleString('en-IN')}` : '—' },
                        { label: 'Amount Paid', value: s.amount_paid ? `₹${Number(s.amount_paid).toLocaleString('en-IN')}` : '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">{label}</p>
                          <p className="text-xs font-semibold text-gray-700 mt-0.5 truncate">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Lifecycle */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5" /> Student Progress
                        <span className="ml-auto font-normal normal-case text-gray-400">{pct}%</span>
                      </p>
                      <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 mb-2">
                        {LIFECYCLE.map((step, i) => {
                          const isDone = (done as any)[step.key]
                          const isCurrent = i === lastIdx + 1
                          const Icon = step.icon
                          return (
                            <div key={step.key} className="flex flex-col items-center gap-1 text-center">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDone ? 'bg-emerald-500' : isCurrent ? 'bg-blue-100 border-2 border-blue-400 border-dashed' : 'bg-gray-100'}`}>
                                <Icon className={`w-3.5 h-3.5 ${isDone ? 'text-white' : isCurrent ? 'text-blue-600' : 'text-gray-400'}`} />
                              </div>
                              <p className={`text-[9px] font-semibold leading-tight ${isDone ? 'text-emerald-700' : isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>{step.label}</p>
                            </div>
                          )
                        })}
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">{records.length} record{records.length !== 1 ? 's' : ''} submitted</p>
                      <Button
                        size="sm"
                        onClick={() => openAddRecord(s.id)}
                        className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 h-8"
                      >
                        <BookMarked className="w-3.5 h-3.5" /> Add Record
                      </Button>
                    </div>

                    {/* History */}
                    {records.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                          <ClipboardList className="w-3.5 h-3.5" /> Submission History
                        </p>
                        {records.map(r => {
                          const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.pending
                          const StatusIcon = cfg.icon
                          const typeCfg = RECORD_TYPES.find(t => t.value === r.task_type)
                          const colorKey = typeCfg?.color ?? 'blue'
                          const clr = COLOR_MAP[colorKey]
                          return (
                            <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-3">
                              <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${clr?.badge}`}>
                                {typeCfg?.label ?? r.task_type}
                              </div>
                              <div className="flex-1 min-w-0">
                                {r.subject_name && <p className="text-sm font-semibold text-gray-800">{r.subject_name}</p>}
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-gray-500">
                                  {r.total_amount != null && (
                                    <span className="flex items-center gap-0.5">
                                      <IndianRupee className="w-3 h-3" />
                                      Total: ₹{r.total_amount}
                                    </span>
                                  )}
                                  {r.student_paid_amount != null && (
                                    <span className="text-emerald-600 font-medium">Paid: ₹{r.student_paid_amount}</span>
                                  )}
                                  {r.status === 'approved' && r.salary_percentage != null && (
                                    <span className="text-green-600 font-semibold">+{r.salary_percentage}% bonus</span>
                                  )}
                                  <span>{format(new Date(r.created_at), 'dd MMM yyyy')}</span>
                                </div>
                                {r.admin_remarks && <p className="text-xs text-gray-400 italic mt-0.5">"{r.admin_remarks}"</p>}
                                {r.screenshot_url && (
                                  <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 flex items-center gap-0.5">
                                    <FileText className="w-3 h-3" /> View Screenshot
                                  </a>
                                )}
                              </div>
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${cfg.color}`}>
                                <StatusIcon className="w-3 h-3" /> {cfg.label}
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
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-violet-600" /> Add Mentorship Record
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Session Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Subject Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Mathematics, English, Science..."
                value={formSubject}
                onChange={e => setFormSubject(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">Total Amount (₹) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={formTotal}
                  onChange={e => setFormTotal(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">Student Paid (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 20"
                  value={formPaid}
                  onChange={e => setFormPaid(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Screenshot / Proof</Label>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setFormFile(e.target.files?.[0] ?? null)} />
              {formFile ? (
                <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                  <Upload className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  <span className="text-sm text-violet-700 flex-1 truncate">{formFile.name}</span>
                  <button onClick={() => setFormFile(null)}><X className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-400 hover:border-violet-300 hover:text-violet-600 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Click to upload screenshot or proof
                </button>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowAdd(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                onClick={submitRecord}
                disabled={submitting}
              >
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Submitting...</>
                  : 'Submit for Approval'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

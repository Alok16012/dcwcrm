'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  GraduationCap, CheckCircle2, Clock, RefreshCw,
  FileText, Award, Upload, X, IndianRupee, BookMarked, Phone, Users,
  Search, Eye, Plus, Wallet,
} from 'lucide-react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StudentLifecycle, lifecycleProgress } from '@/components/shared/StudentLifecycle'

interface AssignedStudent {
  id: string
  full_name: string
  enrollment_number: string | null
  phone: string
  father_name: string | null
  city: string | null
  course: { name: string } | null
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

type StageKey = 'practical' | 'assignment' | 'theory'
const STAGE_ORDER: { key: StageKey; label: string }[] = [
  { key: 'practical',  label: 'Practical' },
  { key: 'assignment', label: 'Assignment' },
  { key: 'theory',     label: 'Theory' },
]
type StageState = Record<StageKey, { subjects: string[]; status: string }>
const emptyStages = (): StageState => ({
  practical:  { subjects: [], status: 'not_started' },
  assignment: { subjects: [], status: 'not_started' },
  theory:     { subjects: [], status: 'not_started' },
})

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  not_started: { label: 'Not Started', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-100 text-emerald-700' },
}
const PAY_CFG: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'Pending',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-600 border-red-200' },
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
  'from-violet-500 to-purple-600','from-blue-500 to-cyan-600','from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600','from-amber-500 to-orange-600','from-indigo-500 to-blue-600',
]
function avatarPalette(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length]
}

interface CaseRow { id: string; student_id: string; managed_by: string | null; total_amount: number | null; stages: any; status: string }
interface Payment { id: string; mentorship_id: string; amount: number; paid_on: string | null; screenshot_url: string | null; note: string | null; status: string; salary_percentage: number | null; admin_remarks: string | null; created_at: string }

export default function MentorshipClient() {
  const supabase = createClient()
  const [students, setStudents] = useState<AssignedStudent[]>([])
  const [cases, setCases] = useState<Record<string, CaseRow>>({}) // by student_id
  const [paysByCase, setPaysByCase] = useState<Record<string, Payment[]>>({})
  const [loading, setLoading] = useState(true)
  const [boardFilter, setBoardFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [detailStudent, setDetailStudent] = useState<AssignedStudent | null>(null)

  // Manage modal state
  const [manageStudent, setManageStudent] = useState<AssignedStudent | null>(null)
  const [caseId, setCaseId] = useState<string | null>(null)
  const [caseMode, setCaseMode] = useState<'dcw' | 'self'>('dcw')
  const [caseTotal, setCaseTotal] = useState('')
  const [stages, setStages] = useState<StageState>(emptyStages())
  const [subjInput, setSubjInput] = useState<Record<StageKey, string>>({ practical: '', assignment: '', theory: '' })
  const [casePayments, setCasePayments] = useState<Payment[]>([])
  const [savingCase, setSavingCase] = useState(false)
  // add-payment sub form
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payFile, setPayFile] = useState<File | null>(null)
  const [addingPay, setAddingPay] = useState(false)
  const payFileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: studs, error } = await (supabase as any).from('students')
        .select(`id, full_name, enrollment_number, phone, father_name, city,
          verification_status, exam_status, result_status, admit_card_url, portal_active, total_fee, amount_paid,
          course:courses(name), sub_section:department_sub_sections(name), session:sessions(name)`)
        .eq('mentor_telecaller_id', user.id)
        .order('full_name')
      if (error) throw error
      setStudents((studs ?? []) as AssignedStudent[])

      // cases for this mentor (prefer rows that have stages set)
      const { data: caseRows } = await (supabase as any).from('student_mentorships')
        .select('id, student_id, managed_by, total_amount, stages, status, created_at')
        .eq('telecaller_id', user.id)
        .order('created_at', { ascending: true })
      const cMap: Record<string, CaseRow> = {}
      ;((caseRows ?? []) as any[]).forEach(c => {
        const hasStages = Array.isArray(c.stages) && c.stages.length > 0
        if (!cMap[c.student_id] || hasStages) cMap[c.student_id] = c
      })
      setCases(cMap)

      const caseIds = Object.values(cMap).map(c => c.id)
      const pMap: Record<string, Payment[]> = {}
      if (caseIds.length) {
        const { data: pays } = await (supabase as any).from('mentorship_payments')
          .select('*').in('mentorship_id', caseIds).order('created_at', { ascending: false })
        ;((pays ?? []) as Payment[]).forEach(p => { (pMap[p.mentorship_id] ||= []).push(p) })
      }
      setPaysByCase(pMap)
    } catch {
      toast.error('Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  function parseStages(raw: any): StageState {
    const st = emptyStages()
    if (Array.isArray(raw)) {
      raw.forEach((s: any) => {
        const k = s.stage as StageKey
        if (st[k]) st[k] = { subjects: Array.isArray(s.subjects) ? s.subjects : [], status: s.status || 'not_started' }
      })
    }
    return st
  }

  function openManage(s: AssignedStudent) {
    const c = cases[s.id]
    setManageStudent(s)
    setCaseId(c?.id ?? null)
    setCaseMode((c?.managed_by as any) === 'self' ? 'self' : 'dcw')
    setCaseTotal(c?.total_amount != null ? String(c.total_amount) : '')
    setStages(c ? parseStages(c.stages) : emptyStages())
    setCasePayments(c ? (paysByCase[c.id] ?? []) : [])
    setSubjInput({ practical: '', assignment: '', theory: '' })
    setPayAmount(''); setPayNote(''); setPayFile(null)
  }

  function addSubject(stage: StageKey) {
    const v = subjInput[stage].trim()
    if (!v) return
    setStages(prev => prev[stage].subjects.includes(v) ? prev : { ...prev, [stage]: { ...prev[stage], subjects: [...prev[stage].subjects, v] } })
    setSubjInput(prev => ({ ...prev, [stage]: '' }))
  }
  function removeSubject(stage: StageKey, sub: string) {
    setStages(prev => ({ ...prev, [stage]: { ...prev[stage], subjects: prev[stage].subjects.filter(x => x !== sub) } }))
  }
  function setStageStatus(stage: StageKey, status: string) {
    setStages(prev => ({ ...prev, [stage]: { ...prev[stage], status } }))
  }

  // returns the case id (creating/updating the row)
  async function persistCase(): Promise<string | null> {
    if (!manageStudent) return null
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const stagesJson = STAGE_ORDER.map(s => ({ stage: s.key, subjects: stages[s.key].subjects, status: stages[s.key].status }))
    const currentStage = (STAGE_ORDER.find(s => stages[s.key].status !== 'completed')?.key) ?? 'theory'
    const payload: any = {
      student_id: manageStudent.id,
      telecaller_id: user.id,
      created_by: user.id,
      task_type: currentStage,
      managed_by: caseMode,
      work_status: stages[currentStage as StageKey]?.status ?? 'in_progress',
      subject_name: STAGE_ORDER.flatMap(s => stages[s.key].subjects).join(', ') || null,
      total_amount: caseMode === 'dcw' ? (parseFloat(caseTotal) || null) : null,
      stages: stagesJson,
      current_stage: currentStage,
      status: 'approved',
      updated_at: new Date().toISOString(),
    }
    if (caseId) {
      const { error } = await (supabase as any).from('student_mentorships').update(payload).eq('id', caseId)
      if (error) throw error
      return caseId
    } else {
      const { data, error } = await (supabase as any).from('student_mentorships').insert(payload).select('id').single()
      if (error) throw error
      setCaseId(data.id)
      return data.id as string
    }
  }

  async function saveCase() {
    if (!manageStudent) return
    if (STAGE_ORDER.every(s => stages[s.key].subjects.length === 0)) { toast.error('Add subjects to at least one stage'); return }
    if (caseMode === 'dcw' && !caseTotal) { toast.error('Total amount required for DCW-managed'); return }
    setSavingCase(true)
    try {
      await persistCase()
      toast.success('Mentorship saved')
      await load()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save')
    } finally {
      setSavingCase(false)
    }
  }

  async function addPayment() {
    if (!manageStudent) return
    if (!payAmount || parseFloat(payAmount) <= 0) { toast.error('Enter a valid amount'); return }
    setAddingPay(true)
    try {
      const id = await persistCase()
      if (!id) throw new Error('Could not save mentorship')
      const { data: { user } } = await supabase.auth.getUser()
      let shot: string | null = null
      if (payFile) {
        const ext = payFile.name.split('.').pop()
        const path = `mentorship/${user!.id}/${manageStudent.id}/pay-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('student-documents').upload(path, payFile, { upsert: true })
        if (upErr) { toast.warning('Screenshot upload failed — payment added without it') }
        else shot = supabase.storage.from('student-documents').getPublicUrl(path).data.publicUrl
      }
      const { data, error } = await (supabase as any).from('mentorship_payments').insert({
        mentorship_id: id,
        amount: parseFloat(payAmount),
        note: payNote.trim() || null,
        screenshot_url: shot,
        paid_on: new Date().toISOString().slice(0, 10),
        status: 'pending',
        created_by: user?.id,
      }).select('*').single()
      if (error) throw error
      setCasePayments(prev => [data as Payment, ...prev])
      setPayAmount(''); setPayNote(''); setPayFile(null)
      if (payFileRef.current) payFileRef.current.value = ''
      toast.success('Payment added — sent for admin approval')
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to add payment')
    } finally {
      setAddingPay(false)
    }
  }

  const boards = ['all', ...Array.from(new Set(students.map(s => s.sub_section?.name).filter(Boolean) as string[]))]
  const filtered = students
    .filter(s => boardFilter === 'all' || s.sub_section?.name === boardFilter)
    .filter(s => !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search) || fmtEnroll(s.enrollment_number).toLowerCase().includes(search.toLowerCase()))

  const allPayments = Object.values(paysByCase).flat()
  const pendingPayCount = allPayments.filter(p => p.status === 'pending').length
  const caseCount = Object.keys(cases).length

  function caseSummary(studentId: string) {
    const c = cases[studentId]
    if (!c) return null
    const pays = paysByCase[c.id] ?? []
    const paid = pays.filter(p => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0)
    const pending = pays.filter(p => p.status === 'pending').length
    return { c, paid, pending, total: c.total_amount ?? 0 }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center"><Award className="w-4 h-4" /></div>
              <h1 className="text-xl font-bold tracking-tight">Mentorship</h1>
            </div>
            <p className="text-violet-200 text-sm mt-1">Manage your students — stages & installment payments</p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <div className="relative grid grid-cols-3 gap-3 mt-5">
          {[
            { icon: Users, label: 'Assigned', value: students.length },
            { icon: BookMarked, label: 'Active Cases', value: caseCount },
            { icon: Clock, label: 'Pending Payments', value: pendingPayCount },
          ].map(stat => (
            <div key={stat.label} className="bg-white/15 rounded-xl px-3 py-3 backdrop-blur-sm">
              <stat.icon className="w-4 h-4 text-white/70 mb-1" />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-[11px] text-white/70 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {boards.map(b => {
            const count = b === 'all' ? students.length : students.filter(s => s.sub_section?.name === b).length
            return (
              <button key={b} onClick={() => setBoardFilter(b)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${boardFilter === b ? 'bg-gray-900 text-white border-gray-900 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                {b === 'all' ? 'All Students' : b}
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${boardFilter === b ? 'bg-white/25' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
              </button>
            )
          })}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Search name, phone..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 h-9 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-violet-400 w-52" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No students found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['S.No', 'Enrollment No', 'Student', "Father's Name", 'Phone', 'City', 'Course', 'Board', 'Session', 'Progress', 'Mentorship', 'Actions'].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s, idx) => {
                  const { lastIdx, pct, total } = lifecycleProgress(s)
                  const palette = avatarPalette(s.full_name)
                  const initials = s.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  const boardName = s.sub_section?.name ?? ''
                  const sum = caseSummary(s.id)
                  return (
                    <tr key={s.id} className="hover:bg-violet-50/30 transition-colors">
                      <td className="px-3 py-3 text-gray-400 text-xs tabular-nums font-medium">{idx + 1}</td>
                      <td className="px-3 py-3"><span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg whitespace-nowrap">{fmtEnroll(s.enrollment_number)}</span></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5 min-w-[140px]">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${palette} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>{initials}</div>
                          <p className="font-semibold text-gray-900 text-sm whitespace-nowrap">{s.full_name}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{s.father_name || '—'}</td>
                      <td className="px-3 py-3">
                        {s.phone ? (
                          <a href={`tel:${s.phone}`} onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline whitespace-nowrap">
                            <Phone className="w-3 h-3" />{s.phone}
                          </a>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{s.city || '—'}</td>
                      <td className="px-3 py-3"><span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">{s.course?.name ?? '—'}</span></td>
                      <td className="px-3 py-3">{boardName ? <span className={`text-xs px-2 py-0.5 rounded-lg font-bold border whitespace-nowrap ${boardBadge(boardName)}`}>{boardName}</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                      <td className="px-3 py-3"><span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">{s.session?.name ?? '—'}</span></td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1 min-w-[80px]">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500">{pct}%</span>
                            <span className="text-[10px] text-gray-400">{lastIdx + 1}/{total}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      {/* Mentorship case */}
                      <td className="px-3 py-3">
                        {sum ? (
                          <div className="flex items-center gap-1 flex-wrap min-w-[110px]">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${sum.c.managed_by === 'self' ? 'bg-gray-200 text-gray-700' : 'bg-violet-100 text-violet-700'}`}>{sum.c.managed_by === 'self' ? 'Self' : 'DCW'}</span>
                            {sum.c.managed_by !== 'self' && <span className="text-[10px] font-semibold text-emerald-700 whitespace-nowrap">₹{sum.paid}/{sum.total}</span>}
                            {sum.pending > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md whitespace-nowrap">⏳{sum.pending}</span>}
                          </div>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" onClick={() => openManage(s)} className="h-7 px-2.5 text-[11px] bg-violet-600 hover:bg-violet-700 text-white gap-1">
                            <BookMarked className="w-3 h-3" /> Manage
                          </Button>
                          <button onClick={() => setDetailStudent(s)} className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50" title="Lifecycle">
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

      {/* Lifecycle detail modal */}
      <Dialog open={!!detailStudent} onOpenChange={open => !open && setDetailStudent(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          {detailStudent && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarPalette(detailStudent.full_name)} flex items-center justify-center text-white font-bold`}>
                      {detailStudent.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{detailStudent.full_name}</p>
                      <p className="text-xs text-gray-400 font-normal">{fmtEnroll(detailStudent.enrollment_number)} · {detailStudent.phone}</p>
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <StudentLifecycle student={detailStudent} title="Student Progress" />
                </div>
                <Button onClick={() => { openManage(detailStudent); setDetailStudent(null) }} className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2">
                  <BookMarked className="w-4 h-4" /> Manage Mentorship
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Mentorship modal */}
      <Dialog open={!!manageStudent} onOpenChange={open => !open && setManageStudent(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center"><BookMarked className="w-4 h-4 text-violet-600" /></div>
              Manage Mentorship
              {manageStudent && <span className="text-sm font-normal text-gray-500 ml-1">— {manageStudent.full_name}</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-1">
            {/* Mode */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setCaseMode('dcw')} className={`py-2.5 rounded-xl text-sm font-bold border-2 ${caseMode === 'dcw' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200'}`}>Managed by DCW</button>
              <button onClick={() => setCaseMode('self')} className={`py-2.5 rounded-xl text-sm font-bold border-2 ${caseMode === 'self' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200'}`}>By Self</button>
            </div>

            {/* Total (DCW) */}
            {caseMode === 'dcw' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Total Mentorship Amount (₹) <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                  <Input type="number" placeholder="e.g. 500" value={caseTotal} onChange={e => setCaseTotal(e.target.value)} className="h-10 pl-7" />
                </div>
              </div>
            )}

            {/* Stage journey */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Stages (journey)</Label>
              {STAGE_ORDER.map((st, i) => {
                const stage = stages[st.key]
                return (
                  <div key={st.key} className="border border-gray-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm font-bold text-gray-800">{st.label}</span>
                      <div className="ml-auto flex gap-1">
                        {(['not_started', 'in_progress', 'completed'] as const).map(stt => (
                          <button key={stt} onClick={() => setStageStatus(st.key, stt)}
                            className={`text-[10px] font-bold px-2 py-1 rounded-md border ${stage.status === stt ? (STATUS_CFG[stt].cls + ' border-transparent') : 'bg-white text-gray-400 border-gray-200'}`}>
                            {STATUS_CFG[stt].label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Add subject, press Enter" value={subjInput[st.key]}
                        onChange={e => setSubjInput(prev => ({ ...prev, [st.key]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubject(st.key) } }}
                        className="h-9 flex-1 text-sm" />
                      <Button type="button" variant="outline" className="h-9 px-3" onClick={() => addSubject(st.key)}>Add</Button>
                    </div>
                    {stage.subjects.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {stage.subjects.map(sub => (
                          <span key={sub} className="inline-flex items-center gap-1 bg-violet-100 text-violet-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                            {sub}<button onClick={() => removeSubject(st.key, sub)}><X className="w-3 h-3 hover:text-red-500" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <Button onClick={saveCase} disabled={savingCase} className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white">
              {savingCase ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Saving...</> : 'Save Mentorship'}
            </Button>

            {/* Payments (DCW only) */}
            {caseMode === 'dcw' && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Installment Payments</Label>
                  {caseTotal && (() => {
                    const paid = casePayments.filter(p => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0)
                    const rem = (parseFloat(caseTotal) || 0) - paid
                    return <span className="text-xs font-semibold text-gray-500">Paid ₹{paid} · Remaining ₹{rem}</span>
                  })()}
                </div>

                {/* Add payment */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                      <Input type="number" placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="h-9 pl-7 bg-white" />
                    </div>
                    <Input placeholder="Note (optional)" value={payNote} onChange={e => setPayNote(e.target.value)} className="h-9 bg-white" />
                  </div>
                  <input ref={payFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setPayFile(e.target.files?.[0] ?? null)} />
                  <div className="flex items-center gap-2">
                    {payFile ? (
                      <div className="flex items-center gap-2 bg-white border border-violet-200 rounded-lg px-3 h-9 flex-1">
                        <FileText className="w-4 h-4 text-violet-600" />
                        <span className="text-xs text-violet-800 truncate flex-1">{payFile.name}</span>
                        <button onClick={() => setPayFile(null)}><X className="w-3.5 h-3.5 text-gray-400" /></button>
                      </div>
                    ) : (
                      <button onClick={() => payFileRef.current?.click()} className="flex items-center gap-1.5 text-xs text-gray-500 border-2 border-dashed border-gray-200 rounded-lg px-3 h-9 flex-1 hover:border-violet-300">
                        <Upload className="w-3.5 h-3.5" /> Screenshot / proof
                      </button>
                    )}
                    <Button onClick={addPayment} disabled={addingPay} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                      {addingPay ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus className="w-3.5 h-3.5" /> Add</>}
                    </Button>
                  </div>
                </div>

                {/* Payment list */}
                {casePayments.length > 0 && (
                  <div className="space-y-1.5">
                    {casePayments.map(p => {
                      const cfg = PAY_CFG[p.status] ?? PAY_CFG.pending
                      return (
                        <div key={p.id} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
                          <IndianRupee className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="text-sm font-bold text-gray-800">₹{p.amount}</span>
                          {p.note && <span className="text-xs text-gray-400 truncate">· {p.note}</span>}
                          <span className="text-[10px] text-gray-400 ml-auto whitespace-nowrap">{format(new Date(p.created_at), 'dd MMM')}</span>
                          {p.screenshot_url && <a href={p.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-blue-500"><FileText className="w-3.5 h-3.5" /></a>}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

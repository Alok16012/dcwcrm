'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  GraduationCap, RefreshCw, Award, X, BookMarked, Phone, Users, Clock,
  Search, Eye, Wallet, FileText, CheckCircle2, ChevronDown,
} from 'lucide-react'
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

type StageKey = 'practical' | 'assignment' | 'theory'
const STAGE_ORDER: { key: StageKey; label: string }[] = [
  { key: 'practical',  label: 'Practical' },
  { key: 'assignment', label: 'Assignment' },
  { key: 'theory',     label: 'Theory' },
]
interface PayEntry { amount: string; date: string; proof_url: string | null; file: File | null; payment_id?: string | null }
interface SubjectRow {
  name: string
  amount: string
  status: string
  payments: PayEntry[]
}
type StageState = Record<StageKey, SubjectRow[]>
const subjCollected = (sub: SubjectRow) => sub.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
const emptyStages = (): StageState => ({ practical: [], assignment: [], theory: [] })
const paymentKey = (amount: number, date: string | null, note: string, proofUrl: string | null) =>
  [amount.toFixed(2), date ?? '', note.trim().toLowerCase(), proofUrl ?? ''].join('|')

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  not_started: { label: 'Not Started', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-100 text-emerald-700' },
}

function fmtEnroll(n: string | null | undefined) {
  if (!n) return '—'
  if (n.startsWith('ENR-')) return 'DCW-' + n.slice(4).replace(/[^0-9]/g, '')
  return n
}
const BOARD_BADGE: Record<string, string> = {
  NIOS: 'bg-blue-100 text-blue-800 border-blue-200',
  BOSSE: 'bg-blue-100 text-blue-800 border-blue-200',
  BBOSE: 'bg-blue-100 text-blue-800 border-blue-200',
}
function boardBadge(name: string) {
  const u = name.toUpperCase()
  for (const k of Object.keys(BOARD_BADGE)) if (u.includes(k)) return BOARD_BADGE[k]
  return 'bg-gray-100 text-gray-700 border-gray-200'
}
const AVATAR_PALETTES = [
  'from-blue-500 to-blue-600','from-blue-500 to-cyan-600','from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600','from-amber-500 to-orange-600','from-indigo-500 to-blue-600',
]
function avatarPalette(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length]
}
const num = (s: string) => parseFloat(s) || 0

// Every session's students now sit in one list, so a mentor needs to narrow by
// more than board. Each filter reads one joined name off the student row.
type FilterKey = 'department' | 'board' | 'standard' | 'session'
const FILTER_DEFS: { key: FilterKey; label: string; of: (s: AssignedStudent) => string | null }[] = [
  { key: 'department', label: 'Department', of: s => s.department?.name ?? null },
  { key: 'board',      label: 'Board',      of: s => s.sub_section?.name ?? null },
  { key: 'standard',   label: 'Standard',   of: s => s.sub_course?.name ?? null },
  { key: 'session',    label: 'Session',    of: s => s.session?.name ?? null },
]

interface CaseRow { id: string; student_id: string; managed_by: string | null; total_amount: number | null; stages: any; status: string }

export default function MentorshipClient() {
  const supabase = createClient()
  const [students, setStudents] = useState<AssignedStudent[]>([])
  const [cases, setCases] = useState<Record<string, CaseRow>>({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    department: '', board: '', standard: '', session: '',
  })
  const [search, setSearch] = useState('')
  const [detailStudent, setDetailStudent] = useState<AssignedStudent | null>(null)

  // Manage modal
  const [manageStudent, setManageStudent] = useState<AssignedStudent | null>(null)
  const [caseId, setCaseId] = useState<string | null>(null)
  const [caseMode, setCaseMode] = useState<'dcw' | 'self'>('dcw')
  const [stages, setStages] = useState<StageState>(emptyStages())
  const [subjInput, setSubjInput] = useState<Record<StageKey, string>>({ practical: '', assignment: '', theory: '' })
  const [savingCase, setSavingCase] = useState(false)
  const [payStatus, setPayStatus] = useState<Record<string, string>>({}) // payment_id -> status

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: studs, error } = await (supabase as any).from('students')
        .select(`id, full_name, enrollment_number, phone, father_name, city,
          verification_status, exam_status, result_status, admit_card_url, portal_active, total_fee, amount_paid,
          course:courses(name), sub_course:sub_courses(name), department:departments(name),
          sub_section:department_sub_sections(name), session:sessions(name)`)
        .eq('mentor_telecaller_id', user.id).order('full_name')
      if (error) throw error
      setStudents((studs ?? []) as AssignedStudent[])

      const { data: caseRows } = await (supabase as any).from('student_mentorships')
        .select('id, student_id, managed_by, total_amount, stages, status, created_at')
        .eq('telecaller_id', user.id).order('created_at', { ascending: true })
      const cMap: Record<string, CaseRow> = {}
      ;((caseRows ?? []) as any[]).forEach(c => {
        const hasStages = Array.isArray(c.stages) && c.stages.length > 0
        if (!cMap[c.student_id] || hasStages) cMap[c.student_id] = c
      })
      setCases(cMap)

      // verification status of each installment (payment_id -> status)
      const caseIds = Object.values(cMap).map(c => c.id)
      if (caseIds.length) {
        const { data: pays } = await (supabase as any).from('mentorship_payments')
          .select('id, status').in('mentorship_id', caseIds)
        const sMap: Record<string, string> = {}
        ;((pays ?? []) as any[]).forEach(p => { sMap[p.id] = p.status })
        setPayStatus(sMap)
      }
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
        if (st[k] && Array.isArray(s.subjects)) {
          st[k] = s.subjects.map((sub: any) => {
            if (typeof sub === 'string') return { name: sub, amount: '', status: 'not_started', payments: [] }
            // installment payments (new) or legacy single collected
            let payments: PayEntry[] = []
            if (Array.isArray(sub.payments)) {
              payments = sub.payments.map((p: any) => ({ amount: p.amount != null ? String(p.amount) : '', date: p.date ?? '', proof_url: p.proof_url ?? null, file: null, payment_id: p.payment_id ?? null }))
            } else if (sub.collected != null && Number(sub.collected) > 0) {
              payments = [{ amount: String(sub.collected), date: sub.paid_on ?? '', proof_url: sub.proof_url ?? null, file: null, payment_id: null }]
            }
            return { name: sub.name ?? '', amount: sub.amount != null ? String(sub.amount) : '', status: sub.status ?? 'not_started', payments }
          })
        }
      })
    }
    return st
  }

  function openManage(s: AssignedStudent) {
    const c = cases[s.id]
    setManageStudent(s)
    setCaseId(c?.id ?? null)
    setCaseMode((c?.managed_by as any) === 'self' ? 'self' : 'dcw')
    setStages(c ? parseStages(c.stages) : emptyStages())
    setSubjInput({ practical: '', assignment: '', theory: '' })
  }

  function addSubject(stage: StageKey) {
    const v = subjInput[stage].trim()
    if (!v) return
    setStages(prev => ({ ...prev, [stage]: [...prev[stage], { name: v, amount: '', status: 'not_started', payments: [] }] }))
    setSubjInput(prev => ({ ...prev, [stage]: '' }))
  }
  function removeSubject(stage: StageKey, idx: number) {
    setStages(prev => ({ ...prev, [stage]: prev[stage].filter((_, i) => i !== idx) }))
  }
  function updateSubject(stage: StageKey, idx: number, patch: Partial<SubjectRow>) {
    setStages(prev => ({ ...prev, [stage]: prev[stage].map((s, i) => i === idx ? { ...s, ...patch } : s) }))
  }
  function addPayment(stage: StageKey, idx: number) {
    setStages(prev => ({ ...prev, [stage]: prev[stage].map((s, i) => i === idx ? { ...s, payments: [...s.payments, { amount: '', date: new Date().toISOString().slice(0, 10), proof_url: null, file: null }] } : s) }))
  }
  function updatePayment(stage: StageKey, idx: number, pidx: number, patch: Partial<PayEntry>) {
    setStages(prev => ({ ...prev, [stage]: prev[stage].map((s, i) => i === idx ? { ...s, payments: s.payments.map((p, j) => j === pidx ? { ...p, ...patch } : p) } : s) }))
  }
  function removePayment(stage: StageKey, idx: number, pidx: number) {
    setStages(prev => ({ ...prev, [stage]: prev[stage].map((s, i) => i === idx ? { ...s, payments: s.payments.filter((_, j) => j !== pidx) } : s) }))
  }

  // overall + per-stage rollups
  const stageTotal = (stage: StageKey) => stages[stage].reduce((s, x) => s + num(x.amount), 0)
  const stageCollected = (stage: StageKey) => stages[stage].reduce((s, x) => s + subjCollected(x), 0)
  const grandTotal = STAGE_ORDER.reduce((s, st) => s + stageTotal(st.key), 0)
  const grandCollected = STAGE_ORDER.reduce((s, st) => s + stageCollected(st.key), 0)
  const grandPending = Math.max(grandTotal - grandCollected, 0)

  async function saveCase() {
    if (!manageStudent) return
    if (STAGE_ORDER.every(s => stages[s.key].length === 0)) { toast.error('Add subjects to at least one stage'); return }
    setSavingCase(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // upload any new installment proof files; keep payment_id for sync
      const built = await Promise.all(STAGE_ORDER.map(async st => {
        const subs = await Promise.all(stages[st.key].map(async sub => {
          const payments = await Promise.all(sub.payments.map(async (p, pi) => {
            let proof = p.proof_url
            if (p.file) {
              const ext = p.file.name.split('.').pop()
              const path = `mentorship/${user.id}/${manageStudent.id}/${st.key}-${sub.name}-${pi}-${Date.now()}.${ext}`
              const { error: upErr } = await supabase.storage.from('student-documents').upload(path, p.file, { upsert: true })
              if (!upErr) proof = supabase.storage.from('student-documents').getPublicUrl(path).data.publicUrl
              else toast.warning(`Proof upload failed for ${sub.name}`)
            }
            return { stage: st.key, subject: sub.name, amount: parseFloat(p.amount) || 0, date: p.date || null, proof_url: proof, payment_id: p.payment_id ?? null }
          }))
          return { name: sub.name, amount: caseMode === 'dcw' ? num(sub.amount) : 0, status: sub.status, payments: caseMode === 'dcw' ? payments : [] }
        }))
        return { stage: st.key, subjects: subs }
      }))

      const total = built.reduce((s, st) => s + st.subjects.reduce((a, x) => a + x.amount, 0), 0)
      const currentStage = STAGE_ORDER.find(s => stages[s.key].some(x => x.status !== 'completed'))?.key ?? 'theory'
      const payload: any = {
        student_id: manageStudent.id,
        telecaller_id: user.id,
        created_by: user.id,
        task_type: currentStage,
        managed_by: caseMode,
        subject_name: STAGE_ORDER.flatMap(s => stages[s.key].map(x => x.name)).join(', ') || null,
        total_amount: caseMode === 'dcw' ? total : null,
        stages: built,
        current_stage: currentStage,
        status: 'approved',
        updated_at: new Date().toISOString(),
      }
      let savedCaseId = caseId
      if (caseId) {
        const { error } = await (supabase as any).from('student_mentorships').update(payload).eq('id', caseId)
        if (error) throw error
      } else {
        const { data, error } = await (supabase as any).from('student_mentorships').insert(payload).select('id').single()
        if (error) throw error
        savedCaseId = data.id
      }

      // Create a verification request (mentorship_payments) for each NEW installment
      if (caseMode === 'dcw' && savedCaseId) {
        const STAGE_LBL: Record<string, string> = { practical: 'Practical', assignment: 'Assignment', theory: 'Theory' }
        const { data: existingPayments } = await (supabase as any).from('mentorship_payments')
          .select('id, amount, paid_on, screenshot_url, note, status')
          .eq('mentorship_id', savedCaseId)
          .neq('status', 'rejected')
        const existingByKey = ((existingPayments ?? []) as any[]).reduce((acc, row) => {
          const key = paymentKey(Number(row.amount ?? 0), row.paid_on ?? null, row.note ?? '', row.screenshot_url ?? null)
          if (!acc[key]) acc[key] = []
          acc[key].push(row)
          return acc
        }, {} as Record<string, any[]>)
        let shouldResaveStages = false
        for (const st of built) {
          for (const sub of st.subjects as any[]) {
            for (const p of sub.payments as any[]) {
              if (!(p.amount > 0)) continue
              const note = `${STAGE_LBL[p.stage] ?? p.stage} · ${sub.name}`
              const linkedStatus = p.payment_id ? payStatus[p.payment_id] : null

              // Already-approved installments are locked — never touch them.
              if (linkedStatus === 'approved') continue

              // A still-pending installment that was edited (amount/date/proof
              // changed): update its verification request in place instead of
              // spawning a duplicate that the admin has to approve again.
              if (p.payment_id && linkedStatus === 'pending') {
                await (supabase as any).from('mentorship_payments').update({
                  amount: p.amount, paid_on: p.date, screenshot_url: p.proof_url, note,
                }).eq('id', p.payment_id).eq('status', 'pending')
                continue
              }

              // New installment, or a previously-rejected one being re-entered:
              // (re)submit it for verification. Rejected rows keep their history;
              // the stage now points at the fresh pending request.
              const key = paymentKey(Number(p.amount), p.date, note, p.proof_url)
              const existing = existingByKey[key]?.shift()
              if (existing) {
                p.payment_id = existing.id
                shouldResaveStages = true
                continue
              }
              const { data: pay, error: payErr } = await (supabase as any).from('mentorship_payments').insert({
                mentorship_id: savedCaseId,
                amount: p.amount,
                paid_on: p.date,
                screenshot_url: p.proof_url,
                note,
                status: 'pending',
                created_by: user.id,
              }).select('id').single()
              if (!payErr && pay) { p.payment_id = pay.id; shouldResaveStages = true }
            }
          }
        }
        // re-save stages with the new payment_ids so re-saving doesn't duplicate
        if (shouldResaveStages) {
          await (supabase as any).from('student_mentorships').update({ stages: built }).eq('id', savedCaseId)
        }
      }

      toast.success('Mentorship saved — payments sent for verification')
      setManageStudent(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save')
    } finally {
      setSavingCase(false)
    }
  }

  const matchesExcept = (s: AssignedStudent, skip: FilterKey | null) =>
    FILTER_DEFS.every(f => f.key === skip || !filters[f.key] || f.of(s) === filters[f.key])

  // Options for each dropdown are narrowed by the OTHER active filters, so a
  // mentor never picks a session that would empty the list. The count next to
  // each option is what selecting it would actually show.
  const optionsFor = (f: (typeof FILTER_DEFS)[number]) => {
    const pool = students.filter(s => matchesExcept(s, f.key))
    const tally = new Map<string, number>()
    pool.forEach(s => { const v = f.of(s); if (v) tally.set(v, (tally.get(v) ?? 0) + 1) })
    // Keep the current selection listed even when the other filters rule it out
    // (Board=Nios with Session=Oct 2026 matches nobody) — a <select> whose value
    // has no matching option renders blank, hiding what is actually applied.
    const cur = filters[f.key]
    if (cur && !tally.has(cur)) tally.set(cur, 0)
    return [...tally.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }

  const term = search.trim().toLowerCase()
  const filtered = students
    .filter(s => matchesExcept(s, null))
    .filter(s => !term
      || s.full_name.toLowerCase().includes(term)
      || s.phone.includes(term)
      || (s.father_name ?? '').toLowerCase().includes(term)
      || fmtEnroll(s.enrollment_number).toLowerCase().includes(term))

  const activeFilters = FILTER_DEFS.filter(f => filters[f.key])
  const clearFilters = () => setFilters({ department: '', board: '', standard: '', session: '' })

  const caseCount = Object.keys(cases).length

  function caseSummary(studentId: string) {
    const c = cases[studentId]
    if (!c) return null
    let total = 0, collected = 0
    if (Array.isArray(c.stages)) c.stages.forEach((st: any) => (st.subjects ?? []).forEach((sub: any) => {
      total += Number(sub.amount ?? 0)
      if (Array.isArray(sub.payments)) collected += sub.payments.reduce((a: number, p: any) => a + Number(p.amount ?? 0), 0)
      else collected += Number(sub.collected ?? 0)
    }))
    return { c, total: total || (c.total_amount ?? 0), collected }
  }
  const grandCollectedAll = Object.keys(cases).reduce((s, sid) => s + (caseSummary(sid)?.collected ?? 0), 0)

  // Installment verification state for a student's existing case — used to warn
  // the counselor before they add another entry for a student who already has
  // one, so the same student doesn't keep coming up for approval.
  function caseInstallmentStatus(studentId: string) {
    const c = cases[studentId]
    if (!c || !Array.isArray(c.stages)) return null
    let pending = 0, approved = 0, total = 0
    c.stages.forEach((st: any) => (st.subjects ?? []).forEach((sub: any) => (sub.payments ?? []).forEach((p: any) => {
      if (!p.payment_id) return
      total++
      const s = payStatus[p.payment_id]
      if (s === 'approved') approved++
      else if (s === 'pending') pending++
    })))
    return { pending, approved, total }
  }
  const manageDupInfo = manageStudent ? caseInstallmentStatus(manageStudent.id) : null

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center"><Award className="w-4 h-4" /></div>
              <h1 className="text-xl font-bold tracking-tight">Mentorship</h1>
            </div>
            <p className="text-blue-200 text-sm mt-1">Manage students — stage-wise subjects, amounts & collection</p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <div className="relative grid grid-cols-3 gap-3 mt-5">
          {[
            { icon: Users, label: 'Assigned', value: students.length },
            { icon: BookMarked, label: 'Active Cases', value: caseCount },
            { icon: Wallet, label: 'Collected', value: `₹${grandCollectedAll.toLocaleString('en-IN')}` },
          ].map(stat => (
            <div key={stat.label} className="bg-white/15 rounded-xl px-3 py-3 backdrop-blur-sm">
              <stat.icon className="w-4 h-4 text-white/70 mb-1" />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-[11px] text-white/70 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar — search, then a dropdown per filter. Native selects so the
          phone opens its own picker instead of a cramped custom menu. */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search name, enrollment, phone..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 h-10 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-400 transition-colors" />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {FILTER_DEFS.map(f => {
            const opts = optionsFor(f)
            const on = !!filters[f.key]
            return (
              <div key={f.key} className="relative">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{f.label}</label>
                <select
                  value={filters[f.key]}
                  onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className={`w-full h-10 pl-3 pr-8 text-sm rounded-xl border appearance-none cursor-pointer focus:outline-none transition-colors ${on ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-600 focus:border-blue-400'}`}>
                  <option value="">All {f.label}s</option>
                  {opts.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
                </select>
                <ChevronDown className={`absolute right-2.5 bottom-3 w-4 h-4 pointer-events-none ${on ? 'text-blue-500' : 'text-gray-400'}`} />
              </div>
            )
          })}
        </div>

        {(activeFilters.length > 0 || term) && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-gray-100">
            <span className="text-xs text-gray-400 font-medium">
              {filtered.length} of {students.length}
            </span>
            {activeFilters.map(f => (
              <button key={f.key} onClick={() => setFilters(prev => ({ ...prev, [f.key]: '' }))}
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 pl-2 pr-1 py-1 rounded-lg hover:bg-blue-100 transition-colors">
                {filters[f.key]}
                <X className="w-3 h-3" />
              </button>
            ))}
            {activeFilters.length > 0 && (
              <button onClick={clearFilters} className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 px-1.5 py-1">
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No students found</p>
          {(activeFilters.length > 0 || term) && (
            <button onClick={() => { clearFilters(); setSearch('') }}
              className="mt-3 text-sm font-semibold text-blue-600 hover:underline">Clear filters</button>
          )}
        </div>
      ) : (
      <>
        {/* Mobile: cards. The 12-column table only works with horizontal
            scrolling, which is unusable on a phone. */}
        <div className="lg:hidden space-y-2.5">
          {filtered.map((s, idx) => {
            const { pct } = lifecycleProgress(s)
            const palette = avatarPalette(s.full_name)
            const initials = s.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            const sum = caseSummary(s.id)
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3.5">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${palette} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>{initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-gray-900 text-[15px] leading-tight">{s.full_name}</p>
                      <span className="text-[10px] text-gray-300 font-medium tabular-nums flex-shrink-0 mt-0.5">#{idx + 1}</span>
                    </div>
                    <p className="font-mono text-[11px] text-gray-500 mt-0.5">{fmtEnroll(s.enrollment_number)}</p>
                    {s.father_name && <p className="text-[11px] text-gray-400 mt-0.5 truncate">s/o {s.father_name}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {s.department?.name && <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-lg font-semibold">{s.department.name}</span>}
                  {s.sub_section?.name && <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border ${boardBadge(s.sub_section.name)}`}>{s.sub_section.name}</span>}
                  {s.sub_course?.name && <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-semibold">{s.sub_course.name}</span>}
                  {s.session?.name && <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg font-semibold">{s.session.name}</span>}
                </div>

                <div className="flex items-center gap-2 mt-2.5">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 tabular-nums">{pct}%</span>
                  {sum && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${sum.c.managed_by === 'self' ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                      {sum.c.managed_by === 'self' ? 'Self' : `₹${sum.collected}/${sum.total}`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" onClick={() => openManage(s)} className="flex-1 h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                    <BookMarked className="w-3.5 h-3.5" /> Manage
                  </Button>
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white active:bg-gray-100" title="Call">
                      <Phone className="w-4 h-4 text-blue-600" />
                    </a>
                  )}
                  <button onClick={() => setDetailStudent(s)} className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white active:bg-gray-100" title="Lifecycle">
                    <Eye className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            )
          })}
          <p className="text-center text-xs text-gray-400 font-medium py-2">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Desktop: full table */}
        <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['S.No', 'Enrollment No', 'Student', "Father's Name", 'Phone', 'City', 'Department', 'Course', 'Standard', 'Board', 'Session', 'Progress', 'Mentorship', 'Actions'].map(h => (
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
                    <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
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
                          <a href={`tel:${s.phone}`} onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline whitespace-nowrap"><Phone className="w-3 h-3" />{s.phone}</a>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{s.city || '—'}</td>
                      <td className="px-3 py-3">{s.department?.name ? <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">{s.department.name}</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                      <td className="px-3 py-3"><span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">{s.course?.name ?? '—'}</span></td>
                      <td className="px-3 py-3">{s.sub_course?.name ? <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">{s.sub_course.name}</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                      <td className="px-3 py-3">{boardName ? <span className={`text-xs px-2 py-0.5 rounded-lg font-bold border whitespace-nowrap ${boardBadge(boardName)}`}>{boardName}</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                      <td className="px-3 py-3"><span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">{s.session?.name ?? '—'}</span></td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1 min-w-[80px]">
                          <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-gray-500">{pct}%</span><span className="text-[10px] text-gray-400">{lastIdx + 1}/{total}</span></div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} /></div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {sum ? (
                          <div className="flex items-center gap-1 flex-wrap min-w-[110px]">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${sum.c.managed_by === 'self' ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>{sum.c.managed_by === 'self' ? 'Self' : 'DCW'}</span>
                            {sum.c.managed_by !== 'self' && <span className="text-[10px] font-semibold text-emerald-700 whitespace-nowrap">₹{sum.collected}/{sum.total}</span>}
                          </div>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" onClick={() => openManage(s)} className="h-7 px-2.5 text-[11px] bg-blue-600 hover:bg-blue-700 text-white gap-1"><BookMarked className="w-3 h-3" /> Manage</Button>
                          <button onClick={() => setDetailStudent(s)} className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50" title="Lifecycle"><Eye className="w-3.5 h-3.5 text-gray-500" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 font-medium">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</div>
        </div>
      </>
      )}

      {/* Lifecycle detail */}
      <Dialog open={!!detailStudent} onOpenChange={open => !open && setDetailStudent(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          {detailStudent && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarPalette(detailStudent.full_name)} flex items-center justify-center text-white font-bold`}>{detailStudent.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                    <div><p className="font-bold text-gray-900">{detailStudent.full_name}</p><p className="text-xs text-gray-400 font-normal">{fmtEnroll(detailStudent.enrollment_number)} · {detailStudent.phone}</p></div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100"><StudentLifecycle student={detailStudent} title="Student Progress" /></div>
                <Button onClick={() => { openManage(detailStudent); setDetailStudent(null) }} className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"><BookMarked className="w-4 h-4" /> Manage Mentorship</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Mentorship modal */}
      <Dialog open={!!manageStudent} onOpenChange={open => !open && setManageStudent(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center"><BookMarked className="w-4 h-4 text-blue-600" /></div>
              Manage Mentorship
              {manageStudent && <span className="text-sm font-normal text-gray-500 ml-1">— {manageStudent.full_name}</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-1">
            {/* Duplicate-entry warning — this student already has a saved case */}
            {caseId && manageDupInfo && manageDupInfo.total > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <span className="text-amber-500 font-bold mt-0.5 flex-shrink-0">⚠</span>
                <p className="text-xs text-amber-800 leading-relaxed">
                  This student already has a mentorship case
                  {manageDupInfo.pending > 0 && <> with <b>{manageDupInfo.pending} installment{manageDupInfo.pending !== 1 ? 's' : ''} still awaiting approval</b></>}
                  {manageDupInfo.approved > 0 && <> ({manageDupInfo.approved} already approved)</>}.
                  You are editing the existing case — only add genuinely new subjects/payments so the same student doesn&apos;t go for approval again.
                </p>
              </div>
            )}
            {/* Mode */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setCaseMode('dcw')} className={`py-2.5 rounded-xl text-sm font-bold border-2 ${caseMode === 'dcw' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>Managed by DCW</button>
              <button onClick={() => setCaseMode('self')} className={`py-2.5 rounded-xl text-sm font-bold border-2 ${caseMode === 'self' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200'}`}>By Self</button>
            </div>

            {/* Auto total summary (DCW) */}
            {caseMode === 'dcw' && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Total Mentorship Amount</p>
                    <p className="text-[10px] text-gray-400">Auto-calculated from all subjects</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold text-gray-900">₹ {grandTotal}</p>
                    <p className="text-[11px] font-semibold"><span className="text-emerald-600">Collected: ₹{grandCollected}</span> · <span className="text-amber-600">Pending: ₹{grandPending}</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* Stages */}
            {STAGE_ORDER.map((st, i) => (
              <div key={st.key} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm font-bold text-gray-800">{st.label}</span>
                  </div>
                  {caseMode === 'dcw' && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Total: ₹{stageTotal(st.key)} | Collected: ₹{stageCollected(st.key)}</span>
                  )}
                </div>
                <div className="p-3 space-y-3">
                  {stages[st.key].map((sub, idx) => {
                    const coll = subjCollected(sub)
                    const pending = num(sub.amount) - coll
                    return (
                      <div key={idx} className="border border-gray-100 rounded-xl p-3 bg-white">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-bold text-gray-800">{sub.name}</span>
                          <div className="flex items-center gap-1">
                            {(['not_started', 'in_progress', 'completed'] as const).map(stt => (
                              <button key={stt} onClick={() => updateSubject(st.key, idx, { status: stt })}
                                className={`text-[9px] font-bold px-1.5 py-1 rounded-md border ${sub.status === stt ? STATUS_CFG[stt].cls + ' border-transparent' : 'bg-white text-gray-400 border-gray-200'}`}>
                                {STATUS_CFG[stt].label}
                              </button>
                            ))}
                            <button onClick={() => removeSubject(st.key, idx)} className="ml-1 text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        {caseMode === 'dcw' && (
                          <>
                            {/* Total + collected/pending summary */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-0.5">
                                <Label className="text-[9px] font-bold text-gray-400 uppercase">Total ₹</Label>
                                <Input type="number" value={sub.amount} onChange={e => updateSubject(st.key, idx, { amount: e.target.value })} className="h-8 text-sm" placeholder="100" />
                              </div>
                              <div className="space-y-0.5">
                                <Label className="text-[9px] font-bold text-emerald-600 uppercase">Collected ₹</Label>
                                <div className="h-8 flex items-center px-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md">{coll}</div>
                              </div>
                              <div className="space-y-0.5">
                                <Label className="text-[9px] font-bold text-amber-600 uppercase">Pending ₹</Label>
                                <div className="h-8 flex items-center px-2 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md">{pending}</div>
                              </div>
                            </div>

                            {/* Installment payments */}
                            <div className="mt-2 space-y-1.5">
                              <p className="text-[9px] font-bold text-gray-400 uppercase">Payments received</p>
                              {sub.payments.map((p, pidx) => {
                                const pst = p.payment_id ? payStatus[p.payment_id] : null
                                return (
                                <div key={pidx} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5">
                                  <div className="relative w-20">
                                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                                    <Input type="number" value={p.amount} onChange={e => updatePayment(st.key, idx, pidx, { amount: e.target.value })} className="h-7 text-xs pl-4 bg-white" placeholder="20" />
                                  </div>
                                  <Input type="date" value={p.date} onChange={e => updatePayment(st.key, idx, pidx, { date: e.target.value })} className="h-7 text-xs flex-1 bg-white" />
                                  {p.file ? (
                                    <button onClick={() => updatePayment(st.key, idx, pidx, { file: null })} className="h-7 px-1.5 flex items-center gap-1 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-700"><FileText className="w-3 h-3" /><X className="w-3 h-3" /></button>
                                  ) : p.proof_url ? (
                                    <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="h-7 px-1.5 flex items-center bg-emerald-50 border border-emerald-200 rounded text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /></a>
                                  ) : (
                                    <label className="h-7 px-1.5 flex items-center border-2 border-dashed border-gray-200 rounded text-gray-400 cursor-pointer hover:border-blue-300"><FileText className="w-3.5 h-3.5" /><input type="file" accept="image/*,.pdf" className="hidden" onChange={e => updatePayment(st.key, idx, pidx, { file: e.target.files?.[0] ?? null })} /></label>
                                  )}
                                  {pst && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pst === 'approved' ? 'bg-emerald-100 text-emerald-700' : pst === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                      {pst === 'approved' ? '✓' : pst === 'rejected' ? '✕' : '⏳'}
                                    </span>
                                  )}
                                  <button onClick={() => removePayment(st.key, idx, pidx)} className="text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              )})}
                              <button onClick={() => addPayment(st.key, idx)} className="w-full flex items-center justify-center gap-1 h-7 border-2 border-dashed border-emerald-200 rounded-lg text-xs font-semibold text-emerald-600 hover:bg-emerald-50">
                                + Add payment
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                  <div className="flex gap-2">
                    <Input placeholder="Add subject, press Enter" value={subjInput[st.key]}
                      onChange={e => setSubjInput(prev => ({ ...prev, [st.key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubject(st.key) } }}
                      className="h-9 flex-1 text-sm" />
                    <Button type="button" onClick={() => addSubject(st.key)} className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white">Add</Button>
                  </div>
                </div>
              </div>
            ))}

            <Button onClick={saveCase} disabled={savingCase} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold">
              {savingCase ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Saving...</> : 'Save Mentorship'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

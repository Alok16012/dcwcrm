'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import {
  Search, GraduationCap, CheckCircle2, Clock, ChevronDown, ChevronUp,
  IndianRupee, FileText, Award, Truck, BookOpen, ClipboardCheck,
  LayoutList, AlertCircle,
} from 'lucide-react'

interface Student {
  id: string
  full_name: string
  enrollment_number: string
  phone: string
  verification_status: string
  exam_status: string
  result_status: string
  total_fee: number | null
  amount_paid: number
  university_name: string | null
  board_name: string | null
  admit_card_url: string | null
  marksheet_url: string | null
  portal_active: boolean
  course?: { name: string } | null
  lead?: { created_at: string; status: string } | null
  dispatched?: boolean
}

const LIFECYCLE = [
  { key: 'lead_received',      label: 'Lead Received',        icon: LayoutList },
  { key: 'docs_submitted',     label: 'Docs Submitted',       icon: FileText },
  { key: 'admission_confirmed',label: 'Admission Confirmed',  icon: GraduationCap },
  { key: 'enrollment_generated',label: 'Enrollment Generated',icon: ClipboardCheck },
  { key: 'exam_form_filled',   label: 'Exam Form Filled',     icon: BookOpen },
  { key: 'hall_ticket_released',label: 'Hall Ticket Released',icon: Award },
  { key: 'result_declared',    label: 'Result Declared',      icon: CheckCircle2 },
  { key: 'marksheet_dispatched',label: 'Marksheet Dispatched',icon: Truck },
]

function getLifecycleStage(student: Student): Record<string, boolean> {
  return {
    lead_received:       true,
    docs_submitted:      ['in_review', 'verified'].includes(student.verification_status),
    admission_confirmed: !!student.enrollment_number,
    enrollment_generated:student.portal_active || !!student.enrollment_number,
    exam_form_filled:    student.exam_status !== 'not_scheduled',
    hall_ticket_released:!!student.admit_card_url,
    result_declared:     ['declared', 'passed', 'failed'].includes(student.result_status),
    marksheet_dispatched:!!student.dispatched,
  }
}

function LifecycleTracker({ student }: { student: Student }) {
  const done = getLifecycleStage(student)
  const keys = LIFECYCLE.map(l => l.key)
  const lastDoneIdx = keys.reduce((acc, k, i) => done[k] ? i : acc, -1)

  return (
    <div className="mt-4 px-4 pb-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Student Progress Lifecycle</p>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
        {LIFECYCLE.map((step, i) => {
          const isDone = done[step.key]
          const isCurrent = i === lastDoneIdx + 1
          const Icon = step.icon
          return (
            <div key={step.key} className="flex flex-col items-center gap-1.5 text-center">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                isDone
                  ? 'bg-emerald-500 shadow-sm shadow-emerald-200'
                  : isCurrent
                    ? 'bg-blue-100 border-2 border-blue-400 border-dashed'
                    : 'bg-gray-100 border border-gray-200'
              }`}>
                <Icon className={`w-4 h-4 ${isDone ? 'text-white' : isCurrent ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
              <p className={`text-[9px] font-semibold leading-tight ${isDone ? 'text-emerald-700' : isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>
                {step.label}
              </p>
            </div>
          )
        })}
      </div>
      <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
          style={{ width: `${Math.round(((lastDoneIdx + 1) / LIFECYCLE.length) * 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-400 mt-1 text-right font-medium">
        {lastDoneIdx + 1} / {LIFECYCLE.length} stages complete
      </p>
    </div>
  )
}

export default function AssociateStudentsPage() {
  const supabase = createClient()
  const db = supabase as any
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: assoc } = await db.from('associates').select('id').eq('user_id', user.id).single()
    if (!assoc) { setLoading(false); return }

    // Primary: students directly linked to this associate
    const { data: directStudents } = await db.from('students').select(`
      id, full_name, enrollment_number, phone, verification_status, exam_status,
      result_status, total_fee, amount_paid, university_name, board_name,
      admit_card_url, marksheet_url, portal_active,
      course:courses(name)
    `).eq('referred_by_associate', assoc.id).order('created_at', { ascending: false })

    // Fallback: students linked via leads
    const { data: assocLeads } = await supabase.from('leads').select('id').eq('referred_by_associate', assoc.id)
    const leadIds = (assocLeads ?? []).map((l: any) => l.id)

    let viaLeads: any[] = []
    if (leadIds.length > 0) {
      const { data } = await db.from('students').select(`
        id, full_name, enrollment_number, phone, verification_status, exam_status,
        result_status, total_fee, amount_paid, university_name, board_name,
        admit_card_url, marksheet_url, portal_active,
        course:courses(name)
      `).in('lead_id', leadIds).order('created_at', { ascending: false })
      viaLeads = data ?? []
    }

    // Merge, deduplicate by id
    const allStudents = [...(directStudents ?? []), ...viaLeads]
    const seen = new Set<string>()
    const unique = allStudents.filter((s: any) => { if (seen.has(s.id)) return false; seen.add(s.id); return true })

    // Check dispatches
    const studentIds = unique.map((s: any) => s.id)
    let dispatchMap: Record<string, boolean> = {}
    if (studentIds.length > 0) {
      const { data: dispatches } = await db.from('student_dispatches')
        .select('student_id, status')
        .in('student_id', studentIds)
        .eq('status', 'delivered')
      ;(dispatches ?? []).forEach((d: any) => { dispatchMap[d.student_id] = true })
    }

    setStudents(unique.map((s: any) => ({ ...s, dispatched: !!dispatchMap[s.id] })))
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  const filtered = students.filter(s =>
    !search ||
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.enrollment_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  )

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const VER_COLOR: Record<string, string> = {
    pending:   'text-amber-700 bg-amber-50 border-amber-200',
    in_review: 'text-blue-700 bg-blue-50 border-blue-200',
    verified:  'text-emerald-700 bg-emerald-50 border-emerald-200',
    rejected:  'text-red-700 bg-red-50 border-red-200',
  }
  const EXAM_COLOR: Record<string, string> = {
    not_scheduled: 'text-gray-500 bg-gray-50 border-gray-200',
    scheduled:     'text-blue-700 bg-blue-50 border-blue-200',
    completed:     'text-indigo-700 bg-indigo-50 border-indigo-200',
    passed:        'text-emerald-700 bg-emerald-50 border-emerald-200',
    failed:        'text-red-700 bg-red-50 border-red-200',
  }
  const RESULT_COLOR: Record<string, string> = {
    awaited:  'text-gray-500 bg-gray-50 border-gray-200',
    declared: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    passed:   'text-emerald-700 bg-emerald-50 border-emerald-200',
    failed:   'text-red-700 bg-red-50 border-red-200',
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Students</h1>
        <p className="text-sm text-gray-400 mt-0.5">{students.length} admitted students with lifecycle tracking</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search name, enrollment, phone…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl bg-white">
          <GraduationCap className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500">{students.length === 0 ? 'No students yet' : 'No matches found'}</p>
          <p className="text-xs text-gray-400 mt-1">{students.length === 0 ? 'Students you refer will appear here after conversion' : 'Try a different search'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const isExpanded = expanded === s.id
            const pending = (s.total_fee ?? 0) - s.amount_paid
            const done = getLifecycleStage(s)
            const keys = LIFECYCLE.map(l => l.key)
            const stagesDone = keys.filter(k => done[k]).length

            return (
              <div key={s.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-sm transition-all">
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                  onClick={() => setExpanded(isExpanded ? null : s.id)}
                >
                  <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{s.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs font-mono text-gray-400">{s.enrollment_number}</span>
                      {s.course && <span className="text-xs text-gray-400">· {s.course.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Mini lifecycle bar */}
                    <div className="hidden md:flex items-center gap-1">
                      {LIFECYCLE.map((step, i) => (
                        <div
                          key={step.key}
                          className={`w-2 h-2 rounded-full ${done[step.key] ? 'bg-emerald-500' : 'bg-gray-200'}`}
                          title={step.label}
                        />
                      ))}
                      <span className="text-[10px] text-gray-400 ml-1">{stagesDone}/{LIFECYCLE.length}</span>
                    </div>
                    {pending > 0 && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200">
                        ₹{pending.toLocaleString('en-IN')} due
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-50 bg-gray-50/30">
                    {/* Status badges */}
                    <div className="flex flex-wrap gap-2 px-5 pt-4">
                      <StatusPill label="Verification" value={s.verification_status.replace(/_/g, ' ')} cls={VER_COLOR[s.verification_status] ?? VER_COLOR['pending']!} />
                      <StatusPill label="Exam" value={s.exam_status.replace(/_/g, ' ')} cls={EXAM_COLOR[s.exam_status] ?? EXAM_COLOR['not_scheduled']!} />
                      <StatusPill label="Result" value={s.result_status.replace(/_/g, ' ')} cls={RESULT_COLOR[s.result_status] ?? RESULT_COLOR['awaited']!} />
                      {s.total_fee && (
                        <StatusPill
                          label="Fee"
                          value={pending > 0 ? `₹${pending.toLocaleString('en-IN')} due` : 'Clear'}
                          cls={pending > 0 ? 'text-red-700 bg-red-50 border-red-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}
                        />
                      )}
                    </div>

                    {/* Board/University */}
                    {(s.university_name || s.board_name) && (
                      <div className="flex flex-wrap gap-4 px-5 pt-3">
                        {s.board_name && (
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Board</p>
                            <p className="text-sm font-medium text-gray-800">{s.board_name}</p>
                          </div>
                        )}
                        {s.university_name && (
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">University</p>
                            <p className="text-sm font-medium text-gray-800">{s.university_name}</p>
                          </div>
                        )}
                        {s.total_fee && (
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Total Fee</p>
                            <p className="text-sm font-medium text-gray-800">{fmt(s.total_fee)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Document links */}
                    {(s.admit_card_url || s.marksheet_url) && (
                      <div className="flex flex-wrap gap-2 px-5 pt-3">
                        {s.admit_card_url && (
                          <a href={s.admit_card_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium">
                            <Award className="w-3 h-3" /> Hall Ticket
                          </a>
                        )}
                        {s.marksheet_url && (
                          <a href={s.marksheet_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 font-medium">
                            <FileText className="w-3 h-3" /> Marksheet
                          </a>
                        )}
                      </div>
                    )}

                    {/* Lifecycle Tracker */}
                    <LifecycleTracker student={s} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusPill({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className={`border rounded-xl px-3 py-2 ${cls}`}>
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">{label}</p>
      <p className="text-xs font-bold capitalize mt-0.5">{value}</p>
    </div>
  )
}

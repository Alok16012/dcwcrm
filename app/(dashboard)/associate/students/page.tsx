'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import {
  Search, GraduationCap, ChevronDown, ChevronUp,
  FileText, Award, Phone, X,
} from 'lucide-react'
import { STUDENT_LIFECYCLE, getLifecycleStage, StudentLifecycle } from '@/components/shared/StudentLifecycle'

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

export default function AssociateStudentsPage() {
  const supabase = createClient()
  const db = supabase as any
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterCourse, setFilterCourse] = useState('')
  const [filterBoard, setFilterBoard] = useState('')
  const [filterVerification, setFilterVerification] = useState('')
  const [filterFee, setFilterFee] = useState('')   // '' | due | clear

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: assoc } = await db.from('associates').select('id, associate_code').eq('user_id', user.id).single()
    if (!assoc) { setLoading(false); return }

    const STUDENT_FIELDS = `
      id, full_name, enrollment_number, phone, verification_status, exam_status,
      result_status, total_fee, amount_paid, university_name, board_name,
      admit_card_url, marksheet_url, portal_active,
      course:courses(name)
    `

    // Path 1: directly linked via referred_by_associate (associates.id)
    const { data: directStudents } = await db.from('students').select(STUDENT_FIELDS)
      .eq('referred_by_associate', assoc.id).order('created_at', { ascending: false })

    // Path 2: students whose lead was referred by this associate
    const { data: assocLeads } = await supabase.from('leads').select('id').eq('referred_by_associate', assoc.id)
    const leadIds = (assocLeads ?? []).map((l: any) => l.id)
    let viaLeads: any[] = []
    if (leadIds.length > 0) {
      const { data } = await db.from('students').select(STUDENT_FIELDS)
        .in('lead_id', leadIds).order('created_at', { ascending: false })
      viaLeads = data ?? []
    }

    // Path 3: via associate_code field (covers legacy / different join method)
    let viaCode: any[] = []
    if (assoc.associate_code) {
      const { data } = await db.from('students').select(STUDENT_FIELDS)
        .eq('referred_by_associate', assoc.associate_code).order('created_at', { ascending: false })
      viaCode = data ?? []
    }

    // Merge, deduplicate by id
    const allStudents = [...(directStudents ?? []), ...viaLeads, ...viaCode]
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

  const dueOf = (s: Student) => (s.total_fee ?? 0) - (s.amount_paid ?? 0)
  const boardOf = (s: Student) => s.board_name || s.university_name || ''

  const courseOptions = [...new Set(students.map(s => s.course?.name).filter(Boolean))].sort() as string[]
  const boardOptions = [...new Set(students.map(boardOf).filter(Boolean))].sort()
  const verificationOptions = [...new Set(students.map(s => s.verification_status).filter(Boolean))].sort()

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      s.full_name.toLowerCase().includes(q) ||
      s.enrollment_number?.toLowerCase().includes(q) ||
      s.phone?.includes(search)
    return matchSearch &&
      (!filterCourse || s.course?.name === filterCourse) &&
      (!filterBoard || boardOf(s) === filterBoard) &&
      (!filterVerification || s.verification_status === filterVerification) &&
      (!filterFee || (filterFee === 'due' ? dueOf(s) > 0 : dueOf(s) <= 0))
  })

  const filtersOn = !!(search || filterCourse || filterBoard || filterVerification || filterFee)
  const clearFilters = () => {
    setSearch(''); setFilterCourse(''); setFilterBoard(''); setFilterVerification(''); setFilterFee('')
  }

  const sumFee = filtered.reduce((a, s) => a + (s.total_fee ?? 0), 0)
  const sumPaid = filtered.reduce((a, s) => a + (s.amount_paid ?? 0), 0)
  const sumDue = filtered.reduce((a, s) => a + Math.max(0, dueOf(s)), 0)

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

      {/* Filters */}
      <div className="bg-white border rounded-2xl p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search name, enrollment, phone…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        {courseOptions.length > 0 && (
          <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className={selectCls}>
            <option value="">All Courses</option>
            {courseOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {boardOptions.length > 0 && (
          <select value={filterBoard} onChange={e => setFilterBoard(e.target.value)} className={selectCls}>
            <option value="">All Boards / Universities</option>
            {boardOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        {verificationOptions.length > 0 && (
          <select value={filterVerification} onChange={e => setFilterVerification(e.target.value)} className={selectCls}>
            <option value="">All Verification</option>
            {verificationOptions.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
          </select>
        )}
        <select value={filterFee} onChange={e => setFilterFee(e.target.value)} className={selectCls}>
          <option value="">All Fees</option>
          <option value="due">Fee due</option>
          <option value="clear">Fee clear</option>
        </select>
        {filtersOn && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-blue-600 hover:underline px-1">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Totals for whatever is filtered */}
      {!loading && students.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MiniStat label="Students" value={String(filtered.length)} tone="indigo" />
          <MiniStat label="Total Fee" value={fmt(sumFee)} tone="blue" />
          <MiniStat label="Received" value={fmt(sumPaid)} tone="emerald" />
          <MiniStat label="Pending" value={fmt(sumDue)} tone={sumDue > 0 ? 'red' : 'emerald'} />
        </div>
      )}

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
          {filtered.map((s, idx) => {
            const isExpanded = expanded === s.id
            const pending = (s.total_fee ?? 0) - s.amount_paid
            const done = getLifecycleStage(s)
            const keys = STUDENT_LIFECYCLE.map(l => l.key)
            const stagesDone = keys.filter(k => done[k]).length

            return (
              <div key={s.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-sm transition-all">
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                  onClick={() => setExpanded(isExpanded ? null : s.id)}
                >
                  <span className="w-6 shrink-0 text-xs font-semibold text-gray-400 tabular-nums">{idx + 1}</span>
                  <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{s.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs font-mono text-gray-400">{s.enrollment_number}</span>
                      {s.course && <span className="text-xs text-gray-400">· {s.course.name}</span>}
                      {boardOf(s) && <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">{boardOf(s)}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] text-gray-500">
                      {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-gray-300" />{s.phone}</span>}
                      {!!s.total_fee && <span className="tabular-nums">Fee {fmt(s.amount_paid ?? 0)} / {fmt(s.total_fee)}</span>}
                      <span className={`font-semibold ${s.verification_status === 'verified' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {s.verification_status.replace(/_/g, ' ')}
                      </span>
                      {s.dispatched && <span className="text-emerald-600 font-semibold">· dispatched</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Mini lifecycle bar */}
                    <div className="hidden md:flex items-center gap-1">
                      {STUDENT_LIFECYCLE.map((step) => (
                        <div
                          key={step.key}
                          className={`w-2 h-2 rounded-full ${done[step.key] ? 'bg-emerald-500' : 'bg-gray-200'}`}
                          title={step.label}
                        />
                      ))}
                      <span className="text-[10px] text-gray-400 ml-1">{stagesDone}/{STUDENT_LIFECYCLE.length}</span>
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

                    {/* Lifecycle Tracker (shared, admin-driven) */}
                    <StudentLifecycle student={s} title="Student Progress Lifecycle" className="mt-4 px-4 pb-4" />
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

const selectCls = 'border rounded-lg px-2 h-9 text-xs bg-white text-gray-700 min-w-36'

const MINI_TONES: Record<string, string> = {
  indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
  blue: 'bg-blue-50 border-blue-100 text-blue-700',
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  red: 'bg-red-50 border-red-100 text-red-700',
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`border rounded-xl px-3 py-2 ${MINI_TONES[tone] ?? MINI_TONES.blue}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-sm font-bold mt-0.5 tabular-nums">{value}</p>
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

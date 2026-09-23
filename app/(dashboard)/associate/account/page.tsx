'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  GraduationCap, Share2, Copy, Check, Building2, Smartphone,
  Search, IndianRupee, Wallet, AlertCircle, Users,
} from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

interface StudentFee {
  id: string
  full_name: string
  enrollment_number: string
  total_fee: number | null
  amount_paid: number
  status: string | null
  course: { name: string } | null
  session: { name: string } | null
}

type PayFilter = '' | 'paid' | 'partial' | 'unpaid'

export default function AssociateAccountPage() {
  const supabase = createClient()
  const db = supabase as any

  const [assocName, setAssocName] = useState('')
  const [code, setCode] = useState('')
  const [students, setStudents] = useState<StudentFee[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [course, setCourse] = useState('')
  const [session, setSession] = useState('')
  const [pay, setPay] = useState<PayFilter>('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: assoc } = await db.from('associates').select('id, name, associate_code').eq('user_id', user.id).single()
    if (!assoc) { setLoading(false); return }
    setAssocName(assoc.name ?? '')
    setCode(assoc.associate_code ?? '')

    const FIELDS = 'id, full_name, enrollment_number, total_fee, amount_paid, status, course:courses(name), session:sessions(name)'

    // Students reach an associate three ways: referred directly, through one of
    // their leads, or tagged with their associate code.
    const { data: assocLeads } = await supabase.from('leads').select('id').eq('referred_by_associate', assoc.id)
    const leadIds = ((assocLeads ?? []) as { id: string }[]).map(l => l.id)

    const [direct, viaLeads, viaCode] = await Promise.all([
      db.from('students').select(FIELDS).eq('referred_by_associate', assoc.id).order('full_name'),
      leadIds.length > 0
        ? db.from('students').select(FIELDS).in('lead_id', leadIds).order('full_name')
        : Promise.resolve({ data: [] }),
      assoc.associate_code
        ? db.from('students').select(FIELDS).eq('referred_by_associate', assoc.associate_code).order('full_name')
        : Promise.resolve({ data: [] }),
    ])

    const seen = new Set<string>()
    const merged = [...(direct.data ?? []), ...(viaLeads.data ?? []), ...(viaCode.data ?? [])]
      .filter((s: StudentFee) => { if (seen.has(s.id)) return false; seen.add(s.id); return true })
    setStudents(merged as StudentFee[])
    setLoading(false)
  }, [supabase, db])

  useEffect(() => { load() }, [load])

  const courses = useMemo(
    () => [...new Set(students.map(s => s.course?.name).filter(Boolean))].sort() as string[],
    [students])
  const sessions = useMemo(
    () => [...new Set(students.map(s => s.session?.name).filter(Boolean))].sort() as string[],
    [students])

  const dueOf = (s: StudentFee) => Math.max(0, (s.total_fee ?? 0) - (s.amount_paid ?? 0))

  const filtered = students.filter(s => {
    const q = search.trim().toLowerCase()
    if (q && !(
      s.full_name.toLowerCase().includes(q) ||
      (s.enrollment_number ?? '').toLowerCase().includes(q)
    )) return false
    if (course && s.course?.name !== course) return false
    if (session && s.session?.name !== session) return false
    if (pay) {
      const due = dueOf(s)
      const paid = s.amount_paid ?? 0
      if (pay === 'paid' && !(paid > 0 && due === 0)) return false
      if (pay === 'partial' && !(paid > 0 && due > 0)) return false
      if (pay === 'unpaid' && paid > 0) return false
    }
    return true
  })

  const totalFee = filtered.reduce((s, st) => s + (st.total_fee ?? 0), 0)
  const totalPaid = filtered.reduce((s, st) => s + (st.amount_paid ?? 0), 0)
  const totalDue = filtered.reduce((s, st) => s + dueOf(st), 0)
  const filtersOn = !!(search || course || session || pay)

  function buildShareText() {
    const lines = [
      `Fee Summary — ${assocName}${code ? ` (${code})` : ''}`,
      '',
      `Students: ${filtered.length}`,
      `Total Revenue: ${fmt(totalFee)}`,
      `Paid:          ${fmt(totalPaid)}`,
      `Due:           ${fmt(totalDue)}`,
      '',
      'Student-wise:',
    ]
    filtered.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.full_name} (${s.enrollment_number ?? '—'})`)
      lines.push(`     Fee: ${fmt(s.total_fee ?? 0)} | Paid: ${fmt(s.amount_paid ?? 0)} | Due: ${fmt(dueOf(s))}`)
    })
    lines.push('')
    lines.push('Pay To:')
    lines.push('  UPI: 88099511@idfcbank')
    lines.push('  A/C: 10170545354 | IFSC: IDFB0060282')
    lines.push('  EDUSPHERE EDUCATIONAL & WELFARE TRUST')
    return lines.join('\n')
  }

  async function handleShare() {
    const text = buildShareText()
    if (navigator.share) {
      try { await navigator.share({ title: 'Fee Summary', text }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const selectCls = 'border border-gray-200 rounded-lg px-2 h-9 text-sm bg-white text-gray-700 min-w-32'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your students&apos; fee summary{code ? ` · Code: ${code}` : ''}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Totals — follow the filters below */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Total Revenue" value={fmt(totalFee)} icon={IndianRupee}
              cls="bg-blue-600 text-white" sub={`${filtered.length} student${filtered.length === 1 ? '' : 's'}`} subCls="text-blue-100" />
            <SummaryCard label="Paid" value={fmt(totalPaid)} icon={Wallet}
              cls="bg-green-50 border border-green-100 text-green-800" subCls="text-green-600" />
            <SummaryCard label="Due" value={totalDue > 0 ? fmt(totalDue) : 'Clear'} icon={AlertCircle}
              cls={totalDue > 0 ? 'bg-red-50 border border-red-100 text-red-800' : 'bg-emerald-50 border border-emerald-100 text-emerald-800'}
              subCls={totalDue > 0 ? 'text-red-600' : 'text-emerald-600'} />
            <SummaryCard label="Students" value={String(filtered.length)} icon={Users}
              cls="bg-indigo-50 border border-indigo-100 text-indigo-800" subCls="text-indigo-600"
              sub={filtersOn ? `of ${students.length} total` : undefined} />
          </div>

          {/* Filters */}
          <div className="bg-white border rounded-xl p-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-44">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name or enrollment no…"
                className="w-full pl-8 pr-3 h-9 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select className={selectCls} value={course} onChange={e => setCourse(e.target.value)}>
              <option value="">All Courses</option>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className={selectCls} value={session} onChange={e => setSession(e.target.value)}>
              <option value="">All Sessions</option>
              {sessions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className={selectCls} value={pay} onChange={e => setPay(e.target.value as PayFilter)}>
              <option value="">All Payments</option>
              <option value="paid">Fully Paid</option>
              <option value="partial">Partly Paid</option>
              <option value="unpaid">Nothing Paid</option>
            </select>
            {filtersOn && (
              <button onClick={() => { setSearch(''); setCourse(''); setSession(''); setPay('') }}
                className="text-xs text-blue-600 hover:underline px-1">Clear</button>
            )}
          </div>

          {/* Student-wise fees */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-indigo-500" />
                <h3 className="font-semibold text-gray-900 text-sm">Student Fee Summary</h3>
                <span className="text-xs text-gray-400">
                  {filtered.length}{filtersOn ? ` of ${students.length}` : ''} students
                </span>
              </div>
              <button onClick={handleShare} disabled={filtered.length === 0}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50">
                {copied ? <><Check className="h-3.5 w-3.5" />Copied!</> : <><Share2 className="h-3.5 w-3.5" />Share</>}
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-400">
                {students.length === 0 ? 'No students yet' : 'No students match these filters'}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((s, i) => {
                  const due = dueOf(s)
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0 text-indigo-600 font-bold text-xs tabular-nums">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{s.full_name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {s.enrollment_number && <span className="text-xs font-mono text-gray-400">{s.enrollment_number}</span>}
                          {s.course?.name && <span className="text-xs text-gray-400">· {s.course.name}</span>}
                          {s.session?.name && <span className="text-xs text-gray-400">· {s.session.name}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        {s.total_fee ? (
                          <>
                            <p className="text-xs font-bold text-gray-700">{fmt(s.total_fee)}</p>
                            <p className="text-[11px] text-gray-400">Paid {fmt(s.amount_paid ?? 0)}</p>
                            <p className={`text-xs font-semibold ${due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {due > 0 ? `${fmt(due)} due` : 'Clear'}
                            </p>
                          </>
                        ) : <p className="text-xs text-gray-400">—</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* DCW Payment Details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900 text-sm">Payment Details</h3>
              </div>
              <button onClick={handleShare}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                {copied ? <><Check className="h-3.5 w-3.5" />Copied!</> : <><Share2 className="h-3.5 w-3.5" />Share</>}
              </button>
            </div>
            <div className="px-5 py-4 border-b border-gray-50 bg-gradient-to-r from-orange-50 to-yellow-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl border border-orange-200 flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-0.5">UPI Payment</p>
                  <p className="text-base font-bold text-gray-900 font-mono">88099511@idfcbank</p>
                  <p className="text-xs text-gray-500 mt-0.5">PhonePe · GPay · Paytm · BHIM</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText('88099511@idfcbank'); toast.success('UPI ID copied!') }}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-white border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 shrink-0">
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Bank Transfer / NEFT / RTGS</p>
              <div className="space-y-2.5">
                {[
                  { label: 'Account Name',   value: 'EDUSPHERE EDUCATIONAL & WELFARE TRUST', mono: false },
                  { label: 'Account Number', value: '10170545354', mono: true },
                  { label: 'IFSC Code',      value: 'IDFB0060282', mono: true },
                  { label: 'SWIFT Code',     value: 'IDFBINBBMUM', mono: true },
                  { label: 'Bank',           value: 'IDFC FIRST Bank', mono: false },
                  { label: 'Branch',         value: 'Patna — Kankarbagh Branch', mono: false },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex items-center gap-3">
                    <p className="text-xs text-gray-400 w-32 shrink-0">{label}</p>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <p className={`text-sm font-semibold text-gray-800 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
                      {mono && (
                        <button onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied!`) }}
                          className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
              <p className="text-xs text-blue-700">After payment, share the receipt with your counsellor for confirmation.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, cls, sub, subCls }: {
  label: string; value: string; icon: React.ElementType; cls: string; sub?: string; subCls?: string
}) {
  return (
    <div className={`rounded-xl p-4 ${cls}`}>
      <div className="flex items-center gap-1.5 opacity-80">
        <Icon className="w-3.5 h-3.5" />
        <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-extrabold mt-1 leading-tight">{value}</p>
      {sub && <p className={`text-[11px] mt-0.5 ${subCls ?? ''}`}>{sub}</p>}
    </div>
  )
}

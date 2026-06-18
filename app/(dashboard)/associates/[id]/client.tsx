'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, GraduationCap, School, UserCog, Clock, CheckCircle2,
  IndianRupee, Wallet, FileText, Phone, MapPin, Building2, RefreshCw,
} from 'lucide-react'
import { STUDENT_LIFECYCLE, getLifecycleStage, lifecycleProgress } from '@/components/shared/StudentLifecycle'

interface CounselorOpt { id: string; full_name: string }

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 border-green-200' },
  pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700 border-red-200' },
}

const fmtMoney = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function AssociateDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const supabase = createClient()
  const db = supabase as any

  const [assoc, setAssoc] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [counselors, setCounselors] = useState<CounselorOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [changingCoord, setChangingCoord] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const FIELDS = `
      id, full_name, total_fee, amount_paid, status, enrollment_date,
      verification_status, exam_status, result_status,
      enrollment_number, portal_active, admit_card_url,
      sub_section:department_sub_sections(name),
      counsellor:profiles!students_assigned_counsellor_fkey(full_name)
    `
    const [{ data: a }, { data: cons }] = await Promise.all([
      db.from('associates').select('*').eq('id', id).single(),
      db.from('profiles').select('id, full_name').in('role', ['counselor', 'lead']).eq('is_active', true).order('full_name'),
    ])
    setAssoc(a)
    setCounselors((cons ?? []) as CounselorOpt[])

    if (a) {
      const { data: direct } = await db.from('students').select(FIELDS).eq('referred_by_associate', a.id)
      const { data: assocLeads } = await db.from('leads').select('id').eq('referred_by_associate', a.id)
      const leadIds = ((assocLeads ?? []) as any[]).map(l => l.id)
      let viaLeads: any[] = []
      if (leadIds.length > 0) {
        const { data } = await db.from('students').select(FIELDS).in('lead_id', leadIds)
        viaLeads = data ?? []
      }
      let viaCode: any[] = []
      if (a.associate_code) {
        const { data } = await db.from('students').select(FIELDS).eq('referred_by_associate', a.associate_code)
        viaCode = data ?? []
      }
      const seen = new Set<string>()
      const merged = [...(direct ?? []), ...viaLeads, ...viaCode].filter((s: any) => {
        if (seen.has(s.id)) return false; seen.add(s.id); return true
      })
      let dispatchMap: Record<string, boolean> = {}
      if (merged.length > 0) {
        const { data: disp } = await db.from('student_dispatches').select('student_id, status')
          .in('student_id', merged.map((s: any) => s.id)).eq('status', 'delivered')
        ;(disp ?? []).forEach((d: any) => { dispatchMap[d.student_id] = true })
      }
      setStudents(merged.map((s: any) => ({ ...s, dispatched: !!dispatchMap[s.id] })))
    }
    setLoading(false)
  }, [db, id])

  useEffect(() => { load() }, [load])

  async function changeCoordinator(counselorId: string) {
    if (!assoc) return
    const newId = counselorId === 'none' ? null : counselorId
    const newName = newId ? (counselors.find(c => c.id === newId)?.full_name ?? null) : null
    setChangingCoord(true)
    try {
      const { error } = await db.from('associates')
        .update({ coordinator_id: newId, coordinator_name: newName, updated_at: new Date().toISOString() })
        .eq('id', assoc.id)
      if (error) throw error
      setAssoc({ ...assoc, coordinator_id: newId, coordinator_name: newName })
      toast.success(newName ? `Counselor set to ${newName}` : 'Counselor removed')
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update counselor')
    } finally {
      setChangingCoord(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" /></div>
  }
  if (!assoc) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.push('/associates')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft className="w-4 h-4" /> Back</button>
        <p className="text-center text-gray-500 py-16">Associate not found</p>
      </div>
    )
  }

  const st = STATUS_CFG[assoc.status] ?? STATUS_CFG.pending
  const totalRevenue = students.reduce((s, x) => s + (x.total_fee ?? 0), 0)
  const received = students.reduce((s, x) => s + (x.amount_paid ?? 0), 0)
  const activeCount = students.filter(x => x.status === 'active').length

  const byBoard = Object.entries(students.reduce((acc: Record<string, number>, s: any) => {
    const b = s.sub_section?.name ?? 'Unassigned'; acc[b] = (acc[b] ?? 0) + 1; return acc
  }, {})).sort((a, b) => b[1] - a[1])
  const byCounselor = Object.entries(students.reduce((acc: Record<string, number>, s: any) => {
    const c = s.counsellor?.full_name ?? 'Not Assigned'; acc[c] = (acc[c] ?? 0) + 1; return acc
  }, {})).sort((a, b) => b[1] - a[1])
  const byMonth = Object.entries(students.reduce((acc: Record<string, number>, s: any) => {
    if (!s.enrollment_date) { acc['Unknown'] = (acc['Unknown'] ?? 0) + 1; return acc }
    const d = new Date(s.enrollment_date)
    acc[`${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`] = (acc[`${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`] ?? 0) + 1
    return acc
  }, {})).sort((a, b) => b[0].localeCompare(a[0]))
  const monthLabel = (k: string) => k === 'Unknown' ? 'Unknown' : `${MONTHS[parseInt(k.split('-')[1])]} ${k.split('-')[0]}`

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => router.push('/associates')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Associates
        </button>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-900 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold">{assoc.name}</h1>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
              {assoc.associate_code && <span className="bg-white/15 px-3 py-1.5 rounded-full font-mono">{assoc.associate_code}</span>}
              <span className="bg-white/15 px-3 py-1.5 rounded-full flex items-center gap-1.5"><Phone className="w-3 h-3" />{assoc.phone}</span>
              {(assoc.state || assoc.district) && <span className="bg-white/15 px-3 py-1.5 rounded-full flex items-center gap-1.5"><MapPin className="w-3 h-3" />{[assoc.district, assoc.state].filter(Boolean).join(', ')}</span>}
              {assoc.institution_name && <span className="bg-white/15 px-3 py-1.5 rounded-full flex items-center gap-1.5"><Building2 className="w-3 h-3" />{assoc.institution_name}</span>}
            </div>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-2 text-right">
            <p className="text-[10px] text-blue-200 uppercase font-bold tracking-wide">Wallet</p>
            <p className="text-lg font-bold">{fmtMoney(assoc.wallet_balance)}</p>
          </div>
        </div>
      </div>

      {/* Counselor change */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5"><UserCog className="w-3.5 h-3.5" /> Counselor / Coordinator</p>
        <div className="flex items-center gap-2 max-w-md">
          <select
            value={assoc.coordinator_id ?? 'none'}
            onChange={e => changeCoordinator(e.target.value)}
            disabled={changingCoord}
            className="flex-1 border border-gray-200 rounded-lg px-3 h-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="none">— Not assigned —</option>
            {counselors.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          {changingCoord && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Admissions', value: students.length.toString(), icon: GraduationCap, cls: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
          { label: 'Active', value: activeCount.toString(), icon: CheckCircle2, cls: 'bg-green-50 border-green-100 text-green-700' },
          { label: 'Total Fee', value: fmtMoney(totalRevenue), icon: IndianRupee, cls: 'bg-blue-50 border-blue-100 text-blue-700' },
          { label: 'Received', value: fmtMoney(received), icon: Wallet, cls: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
        ].map(s => (
          <div key={s.label} className={`border rounded-2xl p-4 ${s.cls}`}>
            <s.icon className="w-4 h-4 mb-2 opacity-70" />
            <p className="text-xl font-extrabold leading-tight">{s.value}</p>
            <p className="text-[10px] font-semibold opacity-70 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Breakdowns */}
      {students.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          <BreakdownCard title="By Board" icon={School} color="blue" items={byBoard} />
          <BreakdownCard title="By Counselor" icon={UserCog} color="blue" items={byCounselor} />
          <BreakdownCard title="Month-wise Admissions" icon={Clock} color="amber" items={byMonth.map(([k, n]) => [monthLabel(k), n] as [string, number])} />
        </div>
      )}

      {/* Students lifecycle */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50">
          <GraduationCap className="h-4 w-4 text-emerald-500" />
          <span className="font-semibold text-gray-900 text-sm">Students Progress</span>
          <span className="text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">{students.length}</span>
        </div>
        {students.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No students referred yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {students.map((s: any) => {
              const done = getLifecycleStage(s)
              const { pct } = lifecycleProgress(s)
              return (
                <div key={s.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{s.full_name}</span>
                    {s.enrollment_number && <span className="text-[10px] font-mono text-gray-400">{s.enrollment_number}</span>}
                    {s.sub_section?.name && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{s.sub_section.name}</span>}
                    {s.counsellor?.full_name && <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{s.counsellor.full_name}</span>}
                    <span className="ml-auto text-[10px] font-bold text-emerald-600">{pct}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {STUDENT_LIFECYCLE.map(step => (
                      <div key={step.key} className={`flex-1 h-1.5 rounded-full ${done[step.key] ? 'bg-emerald-500' : 'bg-gray-200'}`} title={step.label} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Personal & bank details */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Associate Details</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <D label="Email" value={assoc.email} />
          <D label="Father's Phone" value={assoc.father_phone} />
          <D label="Aadhaar" value={assoc.aadhar_number} />
          <D label="PAN" value={assoc.pan_number} />
          <D label="City" value={assoc.current_city || assoc.city} />
          <D label="State" value={assoc.current_state || assoc.state} />
          <D label="Bank" value={assoc.bank_name} />
          <D label="Account Holder" value={assoc.account_holder_name} />
          <D label="Account No." value={assoc.account_number} />
          <D label="IFSC" value={assoc.ifsc_code} />
        </div>
        {(assoc.aadhar_doc_url || assoc.pan_doc_url || assoc.cheque_doc_url) && (
          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-50">
            {assoc.aadhar_doc_url && <DocLink label="Aadhaar" url={assoc.aadhar_doc_url} />}
            {assoc.pan_doc_url && <DocLink label="PAN" url={assoc.pan_doc_url} />}
            {assoc.cheque_doc_url && <DocLink label="Cancelled Cheque" url={assoc.cheque_doc_url} />}
          </div>
        )}
      </div>
    </div>
  )
}

function BreakdownCard({ title, icon: Icon, color, items }: { title: string; icon: any; color: 'blue'|'blue'|'amber'; items: [string, number][] }) {
  const cls = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    amber:  'bg-amber-50 border-amber-100 text-amber-700',
  }[color]
  const dot = { blue: 'text-blue-400', blue: 'text-blue-400', amber: 'text-amber-400' }[color]
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 ? <span className="text-xs text-gray-300">—</span> : items.map(([k, n]) => (
          <span key={k} className={`text-xs border rounded-lg px-2 py-1 font-semibold ${cls}`}>{k} <span className={dot}>· {n}</span></span>
        ))}
      </div>
    </div>
  )
}

function D({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5 break-words">{value || '—'}</p>
    </div>
  )
}

function DocLink({ label, url }: { label: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium">
      <FileText className="w-3 h-3" /> {label}
    </a>
  )
}

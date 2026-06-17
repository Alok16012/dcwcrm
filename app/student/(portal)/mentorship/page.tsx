'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Award, GraduationCap, Phone, IndianRupee, FileText, BookMarked, User, Wallet,
} from 'lucide-react'
import { format } from 'date-fns'

interface MentorProfile { full_name: string; phone: string | null; email: string | null }
interface CaseRow { id: string; managed_by: string | null; total_amount: number | null; stages: any }
interface Payment { id: string; amount: number; note: string | null; screenshot_url: string | null; status: string; created_at: string }

const STAGE_LABEL: Record<string, string> = { practical: 'Practical', assignment: 'Assignment', theory: 'Theory' }
const STAGE_ORDER = ['practical', 'assignment', 'theory']
const STATUS_CFG: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  completed:   { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700' },
}
const PAY_CFG: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-600 border-red-200' },
}

export default function StudentMentorshipPage() {
  const [mentor, setMentor] = useState<MentorProfile | null>(null)
  const [mcase, setMcase] = useState<CaseRow | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [noMentor, setNoMentor] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: student } = await (supabase as any).from('students')
          .select('id, mentor_telecaller_id').eq('portal_user_id', user.id).single()
        if (!student?.mentor_telecaller_id) { setNoMentor(true); return }

        const { data: mentorData } = await supabase.from('profiles')
          .select('full_name, phone, email').eq('id', student.mentor_telecaller_id).single()
        setMentor(mentorData as unknown as MentorProfile)

        // latest case (row with stages)
        const { data: caseRows } = await (supabase as any).from('student_mentorships')
          .select('id, managed_by, total_amount, stages, created_at')
          .eq('student_id', student.id).order('created_at', { ascending: false })
        const c = ((caseRows ?? []) as any[]).find(r => Array.isArray(r.stages) && r.stages.length > 0) ?? (caseRows ?? [])[0] ?? null
        setMcase(c)
        if (c) {
          const { data: pays } = await (supabase as any).from('mentorship_payments')
            .select('id, amount, note, screenshot_url, status, created_at')
            .eq('mentorship_id', c.id).order('created_at', { ascending: false })
          setPayments((pays ?? []) as Payment[])
        }
      } catch { /* silent */ } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  const isDcw = mcase?.managed_by !== 'self'
  const total = mcase?.total_amount ?? 0
  const paid = payments.filter(p => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0)
  const remaining = Math.max(total - paid, 0)
  const stageArr: { stage: string; subjects: string[]; status: string }[] = Array.isArray(mcase?.stages) ? mcase!.stages : []
  const stageMap: Record<string, { subjects: string[]; status: string }> = {}
  stageArr.forEach(s => { stageMap[s.stage] = { subjects: s.subjects ?? [], status: s.status ?? 'not_started' } })

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-6 h-6 text-violet-600" /> Mentorship
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Your mentor, learning stages & payments</p>
      </div>

      {noMentor || !mentor ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No mentor assigned yet</p>
          <p className="text-sm text-gray-400 mt-1">Contact support if you need mentorship assistance</p>
        </div>
      ) : (
        <>
          {/* Mentor card */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-5 text-white">
            <p className="text-violet-200 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Your Mentor</p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {mentor.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-bold">{mentor.full_name}</p>
                {mentor.phone && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <a href={`tel:${mentor.phone}`} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-sm font-medium"><Phone className="w-3.5 h-3.5" />{mentor.phone}</a>
                    <a href={`https://wa.me/91${mentor.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-green-500/80 hover:bg-green-500 px-3 py-1 rounded-full text-sm font-medium">WhatsApp</a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {!mcase ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
              <BookMarked className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">Your mentorship plan will appear here soon</p>
            </div>
          ) : (
            <>
              {/* Mode + payment summary (DCW) */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${isDcw ? 'bg-violet-100 text-violet-700' : 'bg-gray-200 text-gray-700'}`}>{isDcw ? 'Managed by DCW' : 'By Self'}</span>
              </div>

              {isDcw && total > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total', value: total, color: 'bg-violet-50 text-violet-700' },
                    { label: 'Paid', value: paid, color: 'bg-emerald-50 text-emerald-700' },
                    { label: 'Remaining', value: remaining, color: 'bg-amber-50 text-amber-700' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
                      <p className="text-lg font-bold">₹{s.value.toLocaleString('en-IN')}</p>
                      <p className="text-xs font-semibold mt-0.5 opacity-80">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Stages journey */}
              <div>
                <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5"><BookMarked className="w-4 h-4 text-violet-600" /> Learning Stages</h2>
                <div className="space-y-2.5">
                  {STAGE_ORDER.map((key, i) => {
                    const st = stageMap[key] ?? { subjects: [], status: 'not_started' }
                    const cfg = STATUS_CFG[st.status] ?? STATUS_CFG.not_started
                    return (
                      <div key={key} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                          <span className="text-sm font-bold text-gray-800">{STAGE_LABEL[key]}</span>
                          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        {st.subjects.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {st.subjects.map(sub => <span key={sub} className="text-xs bg-violet-50 text-violet-700 font-semibold px-2 py-0.5 rounded-lg">{sub}</span>)}
                          </div>
                        ) : <p className="text-xs text-gray-400">No subjects yet</p>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Payment ledger (DCW) */}
              {isDcw && (
                <div>
                  <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5"><Wallet className="w-4 h-4 text-emerald-600" /> Payment History</h2>
                  {payments.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-200">
                      <p className="text-sm text-gray-400">No payments recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payments.map(p => {
                        const cfg = PAY_CFG[p.status] ?? PAY_CFG.pending
                        return (
                          <div key={p.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-2">
                            <IndianRupee className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="text-sm font-bold text-gray-800">₹{Number(p.amount).toLocaleString('en-IN')}</span>
                            {p.note && <span className="text-xs text-gray-400 truncate">· {p.note}</span>}
                            <span className="text-[10px] text-gray-400 ml-auto whitespace-nowrap">{format(new Date(p.created_at), 'dd MMM yyyy')}</span>
                            {p.screenshot_url && <a href={p.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-blue-500"><FileText className="w-3.5 h-3.5" /></a>}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

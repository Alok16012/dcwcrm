'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Award, GraduationCap, Phone, FileText, BookMarked, User } from 'lucide-react'
import { format } from 'date-fns'

interface MentorProfile { full_name: string; phone: string | null; email: string | null }
interface CaseRow { id: string; managed_by: string | null; total_amount: number | null; stages: any }
interface SubjectObj { name: string; amount: number; collected: number; status: string; proof_url: string | null; paid_on: string | null }

const STAGE_LABEL: Record<string, string> = { practical: 'Practical', assignment: 'Assignment', theory: 'Theory' }
const STAGE_ORDER = ['practical', 'assignment', 'theory']
const STATUS_CFG: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  completed:   { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700' },
}

export default function StudentMentorshipPage() {
  const [mentor, setMentor] = useState<MentorProfile | null>(null)
  const [mcase, setMcase] = useState<CaseRow | null>(null)
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

        const { data: caseRows } = await (supabase as any).from('student_mentorships')
          .select('id, managed_by, total_amount, stages, created_at')
          .eq('student_id', student.id).order('created_at', { ascending: false })
        const c = ((caseRows ?? []) as any[]).find(r => Array.isArray(r.stages) && r.stages.length > 0) ?? (caseRows ?? [])[0] ?? null
        setMcase(c)
      } catch { /* silent */ } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  const isDcw = mcase?.managed_by !== 'self'
  const stageArr: { stage: string; subjects: SubjectObj[] }[] = Array.isArray(mcase?.stages)
    ? mcase!.stages.map((st: any) => ({
        stage: st.stage,
        subjects: (st.subjects ?? []).map((sub: any) =>
          typeof sub === 'string'
            ? { name: sub, amount: 0, collected: 0, status: 'not_started', proof_url: null, paid_on: null }
            : { name: sub.name ?? '', amount: Number(sub.amount ?? 0), collected: Number(sub.collected ?? 0), status: sub.status ?? 'not_started', proof_url: sub.proof_url ?? null, paid_on: sub.paid_on ?? null }
        ),
      }))
    : []
  const stageMap: Record<string, SubjectObj[]> = {}
  stageArr.forEach(s => { stageMap[s.stage] = s.subjects })
  const allSubs = stageArr.flatMap(s => s.subjects)
  const total = allSubs.reduce((s, x) => s + x.amount, 0)
  const collected = allSubs.reduce((s, x) => s + x.collected, 0)
  const remaining = Math.max(total - collected, 0)

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Award className="w-6 h-6 text-blue-600" /> Mentorship</h1>
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
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
            <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Your Mentor</p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">{mentor.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${isDcw ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}>{isDcw ? 'Managed by DCW' : 'By Self'}</span>
              </div>

              {isDcw && total > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total', value: total, color: 'bg-blue-50 text-blue-700' },
                    { label: 'Collected', value: collected, color: 'bg-emerald-50 text-emerald-700' },
                    { label: 'Pending', value: remaining, color: 'bg-amber-50 text-amber-700' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
                      <p className="text-lg font-bold">₹{s.value.toLocaleString('en-IN')}</p>
                      <p className="text-xs font-semibold mt-0.5 opacity-80">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Stages with per-subject breakdown */}
              <div className="space-y-3">
                {STAGE_ORDER.map((key, i) => {
                  const subs = stageMap[key] ?? []
                  const stTotal = subs.reduce((s, x) => s + x.amount, 0)
                  const stColl = subs.reduce((s, x) => s + x.collected, 0)
                  return (
                    <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                          <span className="text-sm font-bold text-gray-800">{STAGE_LABEL[key]}</span>
                        </div>
                        {isDcw && stTotal > 0 && <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">₹{stColl}/{stTotal}</span>}
                      </div>
                      <div className="p-3 space-y-2">
                        {subs.length === 0 ? <p className="text-xs text-gray-400">No subjects yet</p> : subs.map((sub, idx) => {
                          const cfg = STATUS_CFG[sub.status] ?? STATUS_CFG.not_started
                          const pending = sub.amount - sub.collected
                          return (
                            <div key={idx} className="border border-gray-100 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-semibold text-gray-800">{sub.name}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                                {sub.proof_url && <a href={sub.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 ml-auto"><FileText className="w-3.5 h-3.5" /></a>}
                              </div>
                              {isDcw && sub.amount > 0 && (
                                <div className="flex items-center gap-3 flex-wrap text-xs">
                                  <span className="text-gray-500">Total: <b className="text-gray-700">₹{sub.amount}</b></span>
                                  <span className="text-emerald-600">Collected: ₹{sub.collected}</span>
                                  {pending > 0 && <span className="text-amber-600">Pending: ₹{pending}</span>}
                                  {sub.paid_on && <span className="text-gray-400">· {format(new Date(sub.paid_on), 'dd MMM yyyy')}</span>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

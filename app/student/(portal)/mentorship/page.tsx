'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Award, GraduationCap, Phone, CheckCircle2, Clock,
  XCircle, IndianRupee, FileText, BookMarked, User,
} from 'lucide-react'
import { format } from 'date-fns'

interface MentorProfile {
  full_name: string
  phone: string | null
  email: string | null
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
  created_at: string
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  practical:  { label: 'Practical',   color: 'bg-emerald-100 text-emerald-800' },
  assignment: { label: 'Assignment',  color: 'bg-blue-100 text-blue-800' },
  theory:     { label: 'Theory',      color: 'bg-purple-100 text-purple-800' },
  work_assignment: { label: 'Work Assignment', color: 'bg-blue-100 text-blue-800' },
  exam:       { label: 'Exam',        color: 'bg-purple-100 text-purple-800' },
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:  { label: 'Pending',  color: 'bg-amber-100 text-amber-700 border-amber-200',  icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700 border-green-200',  icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200',        icon: XCircle },
}

export default function StudentMentorshipPage() {
  const [mentor, setMentor] = useState<MentorProfile | null>(null)
  const [records, setRecords] = useState<MentorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [noMentor, setNoMentor] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get student record
        const { data: student } = await (supabase as any)
          .from('students')
          .select('id, mentor_telecaller_id')
          .eq('portal_email', user.email)
          .single()

        if (!student?.mentor_telecaller_id) {
          setNoMentor(true)
          return
        }

        // Fetch mentor profile
        const { data: mentorData } = await supabase
          .from('profiles')
          .select('full_name, phone, email')
          .eq('id', student.mentor_telecaller_id)
          .single()

        setMentor(mentorData as unknown as MentorProfile)

        // Fetch mentorship records
        const { data: recs } = await (supabase as any)
          .from('student_mentorships')
          .select('id, task_type, subject_name, total_amount, student_paid_amount, screenshot_url, status, admin_remarks, created_at')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })

        setRecords((recs ?? []) as MentorRecord[])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-6 h-6 text-violet-600" /> Mentorship
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Your assigned mentor and session records</p>
      </div>

      {noMentor || !mentor ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No mentor assigned yet</p>
          <p className="text-sm text-gray-400 mt-1">Contact support if you need mentorship assistance</p>
        </div>
      ) : (
        <>
          {/* Mentor Card */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-5 text-white">
            <p className="text-violet-200 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Your Mentor
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {mentor.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-bold">{mentor.full_name}</p>
                {mentor.phone && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <a
                      href={`tel:${mentor.phone}`}
                      className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-sm font-medium transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {mentor.phone}
                    </a>
                    <a
                      href={`https://wa.me/91${mentor.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-green-500/80 hover:bg-green-500 px-3 py-1 rounded-full text-sm font-medium transition-colors"
                    >
                      WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Sessions', value: records.length, color: 'bg-violet-50 text-violet-700' },
              { label: 'Approved', value: records.filter(r => r.status === 'approved').length, color: 'bg-green-50 text-green-700' },
              { label: 'Pending', value: records.filter(r => r.status === 'pending').length, color: 'bg-amber-50 text-amber-700' },
            ].map(stat => (
              <div key={stat.label} className={`rounded-xl p-3 text-center ${stat.color}`}>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs font-semibold mt-0.5 opacity-80">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Records */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
              <BookMarked className="w-4 h-4 text-violet-600" /> Session Records
            </h2>
            {records.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                <BookMarked className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-400">No sessions recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {records.map(r => {
                  const typeCfg = TYPE_LABELS[r.task_type] ?? { label: r.task_type, color: 'bg-gray-100 text-gray-700' }
                  const statusCfg = STATUS_CFG[r.status] ?? STATUS_CFG.pending
                  const StatusIcon = statusCfg.icon
                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${typeCfg.color}`}>
                              {typeCfg.label}
                            </span>
                            {r.subject_name && (
                              <span className="text-sm font-semibold text-gray-800">{r.subject_name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
                            {r.total_amount != null && (
                              <span className="flex items-center gap-0.5">
                                <IndianRupee className="w-3 h-3" /> Total: ₹{r.total_amount}
                              </span>
                            )}
                            {r.student_paid_amount != null && (
                              <span className="text-emerald-600 font-medium">
                                Paid: ₹{r.student_paid_amount}
                              </span>
                            )}
                            <span>{format(new Date(r.created_at), 'dd MMM yyyy')}</span>
                          </div>
                          {r.admin_remarks && (
                            <p className="text-xs text-gray-400 italic mt-1">"{r.admin_remarks}"</p>
                          )}
                          {r.screenshot_url && (
                            <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline mt-1 flex items-center gap-0.5">
                              <FileText className="w-3 h-3" /> View Proof
                            </a>
                          )}
                        </div>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${statusCfg.color}`}>
                          <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

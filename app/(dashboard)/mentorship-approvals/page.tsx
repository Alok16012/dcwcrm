'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, GraduationCap, RefreshCw, IndianRupee, Star } from 'lucide-react'

export default function MentorshipApprovalsPage() {
  const supabase = createClient()

  const [mentorships, setMentorships] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [salaryPct, setSalaryPct] = useState<Record<string, string>>({})
  const [adminRemarks, setAdminRemarks] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('student_mentorships')
      .select(`
        *,
        student:students(id, full_name, enrollment_number, phone),
        telecaller:profiles!student_mentorships_telecaller_id_fkey(id, full_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setMentorships(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function approve(id: string) {
    setApprovingId(id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const pct = salaryPct[id] ? parseFloat(salaryPct[id]) : null
      const remarks = adminRemarks[id] || null
      const { error } = await (supabase as any)
        .from('student_mentorships')
        .update({
          status: 'approved',
          salary_percentage: pct,
          admin_remarks: remarks,
          approved_by: user?.id ?? null,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
      toast.success('Mentorship approved')
      setMentorships(prev => prev.filter(m => m.id !== id))
    } catch {
      toast.error('Failed to approve')
    } finally {
      setApprovingId(null)
    }
  }

  async function reject(id: string) {
    setApprovingId(id)
    try {
      const remarks = adminRemarks[id] || null
      const { error } = await (supabase as any)
        .from('student_mentorships')
        .update({ status: 'rejected', admin_remarks: remarks, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      toast.success('Mentorship rejected')
      setMentorships(prev => prev.filter(m => m.id !== id))
    } catch {
      toast.error('Failed to reject')
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Mentorship Approvals" description="Review and approve submitted mentorship work" />
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
      ) : mentorships.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-white border rounded-xl">
          <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No pending mentorships</p>
          <p className="text-xs mt-1">Submissions from leads and counselors will appear here</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white">
          <div className="px-4 py-2.5 bg-violet-50 border-b flex items-center justify-between">
            <p className="text-xs font-bold text-violet-700 uppercase tracking-wider">Pending Mentorship Approvals</p>
            <span className="text-xs text-violet-600">{mentorships.length} pending</span>
          </div>
          <div className="divide-y">
            {mentorships.map((m: any) => (
              <div key={m.id} className="px-4 py-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-gray-800">{m.student?.full_name ?? '—'}</span>
                      {m.student?.enrollment_number && (
                        <span className="text-xs text-gray-400 font-mono">#{m.student.enrollment_number}</span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                        {m.task_type === 'work_assignment' ? 'Work Assignment' : m.task_type === 'practical' ? 'Practical' : 'Exam'}
                      </span>
                      {m.rating != null && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-600 font-semibold">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {m.rating}/10
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Mentor: <span className="font-semibold text-gray-700">{m.telecaller?.full_name ?? '—'}</span>
                      {m.student?.phone && <> · {m.student.phone}</>}
                    </p>
                    {m.description && (
                      <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">{m.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <IndianRupee className="w-3.5 h-3.5 text-green-600" />
                        <input
                          type="number" min="0" max="100" step="0.5"
                          placeholder="Salary % bonus"
                          value={salaryPct[m.id] ?? ''}
                          onChange={e => setSalaryPct(prev => ({ ...prev, [m.id]: e.target.value }))}
                          className="w-36 h-7 text-xs border border-gray-300 rounded px-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                        />
                      </div>
                      <input
                        type="text" placeholder="Admin remarks (optional)"
                        value={adminRemarks[m.id] ?? ''}
                        onChange={e => setAdminRemarks(prev => ({ ...prev, [m.id]: e.target.value }))}
                        className="flex-1 min-w-[180px] h-7 text-xs border border-gray-300 rounded px-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button size="sm" className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700"
                      disabled={approvingId === m.id} onClick={() => approve(m.id)}>
                      {approvingId === m.id
                        ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><CheckCircle2 className="w-3.5 h-3.5" /> Approve</>}
                    </Button>
                    <Button size="sm" variant="outline"
                      className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={approvingId === m.id} onClick={() => reject(m.id)}>
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

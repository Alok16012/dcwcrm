import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  GraduationCap, Wallet, BookOpen, HelpCircle, Bell,
  ChevronRight, CheckCircle2, Clock, AlertCircle, User,
  FileText, IndianRupee, ArrowRight, Paperclip,
} from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────
const VER: Record<string, { label: string; cls: string; done: boolean; active: boolean }> = {
  pending:   { label: 'Pending',   cls: 'text-yellow-600 bg-yellow-50 border-yellow-200', done: false, active: true },
  in_review: { label: 'In Review', cls: 'text-blue-600 bg-blue-50 border-blue-200',       done: false, active: true },
  verified:  { label: 'Verified',  cls: 'text-green-600 bg-green-50 border-green-200',    done: true,  active: false },
  rejected:  { label: 'Rejected',  cls: 'text-red-600 bg-red-50 border-red-200',          done: false, active: false },
}
const EXAM: Record<string, { label: string; cls: string; done: boolean }> = {
  not_scheduled:  { label: 'Not Scheduled', cls: 'text-gray-500 bg-gray-50 border-gray-200',      done: false },
  scheduled:      { label: 'Scheduled',     cls: 'text-blue-600 bg-blue-50 border-blue-200',       done: false },
  completed:      { label: 'Completed',     cls: 'text-indigo-600 bg-indigo-50 border-indigo-200', done: true },
  result_awaited: { label: 'Result Awaited',cls: 'text-yellow-600 bg-yellow-50 border-yellow-200', done: false },
  passed:         { label: 'Passed',        cls: 'text-green-600 bg-green-50 border-green-200',    done: true },
  failed:         { label: 'Failed',        cls: 'text-red-600 bg-red-50 border-red-200',          done: false },
}
const RESULT: Record<string, { label: string; cls: string; done: boolean }> = {
  awaited:  { label: 'Awaited',  cls: 'text-gray-500 bg-gray-50 border-gray-200',      done: false },
  declared: { label: 'Declared', cls: 'text-green-600 bg-green-50 border-green-200',   done: true },
  passed:   { label: 'Passed',   cls: 'text-green-600 bg-green-50 border-green-200',   done: true },
  failed:   { label: 'Failed',   cls: 'text-red-600 bg-red-50 border-red-200',         done: false },
}

const NOTIF_CLS: Record<string, string> = {
  info:    'bg-blue-50 border-blue-200',
  success: 'bg-green-50 border-green-200',
  warning: 'bg-yellow-50 border-yellow-200',
  alert:   'bg-red-50 border-red-200',
}
const NOTIF_DOT: Record<string, string> = {
  info: 'bg-blue-500', success: 'bg-green-500', warning: 'bg-yellow-500', alert: 'bg-red-500',
}

// ── timeline step ────────────────────────────────────────────
function TimelineStep({
  step, label, sub, done, active, last,
}: { step: number; label: string; sub: string; done: boolean; active: boolean; last?: boolean }) {
  return (
    <div className="flex flex-col items-center flex-1">
      <div className="relative flex items-center w-full">
        {/* Left connector */}
        <div className={`flex-1 h-0.5 ${step === 1 ? 'opacity-0' : done ? 'bg-green-400' : 'bg-gray-200'}`} />
        {/* Circle */}
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 shrink-0 ${
          done    ? 'bg-green-500 border-green-500 text-white' :
          active  ? 'bg-blue-500 border-blue-500 text-white animate-pulse' :
                    'bg-white border-gray-300 text-gray-400'
        }`}>
          {done ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : active ? (
            <Clock className="w-4 h-4" />
          ) : (
            <span className="text-xs font-bold">{step}</span>
          )}
        </div>
        {/* Right connector */}
        <div className={`flex-1 h-0.5 ${last ? 'opacity-0' : done ? 'bg-green-400' : 'bg-gray-200'}`} />
      </div>
      <p className={`text-xs font-semibold mt-1.5 text-center ${done ? 'text-green-700' : active ? 'text-blue-700' : 'text-gray-400'}`}>
        {label}
      </p>
      <p className={`text-[10px] text-center mt-0.5 ${done ? 'text-green-500' : active ? 'text-blue-500' : 'text-gray-300'}`}>
        {sub}
      </p>
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────
export default async function StudentDashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/student/login')

  const { data: student } = await supabase
    .from('students')
    .select(`
      id, full_name, enrollment_number, status,
      verification_status, exam_status, result_status, admission_progress,
      total_fee, amount_paid, enrollment_date,
      course:courses(name), department:departments(name), sub_section:department_sub_sections(name)
    `)
    .eq('portal_user_id', user.id)
    .single()

  if (!student) redirect('/student/login')

  const s = student as {
    id: string; full_name: string; enrollment_number: string; status: string;
    verification_status: string; exam_status: string; result_status: string;
    admission_progress: number; total_fee: number | null; amount_paid: number;
    enrollment_date: string | null;
    course: { name: string } | null; department: { name: string } | null; sub_section: { name: string } | null;
  }

  const pending = (s.total_fee ?? 0) - s.amount_paid

  const db = supabase as any
  const [{ data: notifs }, { data: announcements }] = await Promise.all([
    db.from('student_notifications')
      .select('id, title, message, type, category, file_url, is_read, created_at')
      .eq('student_id', s.id)
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('student_announcements')
      .select('id, title, body, type, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  // Derive timeline step states
  const enrolled    = true
  const verDone     = s.verification_status === 'verified'
  const verActive   = ['pending', 'in_review'].includes(s.verification_status)
  const examDone    = ['completed', 'passed', 'failed'].includes(s.exam_status)
  const examActive  = ['scheduled', 'result_awaited'].includes(s.exam_status)
  const resultDone  = ['declared', 'passed', 'failed'].includes(s.result_status)
  const resultActive = s.result_status === 'awaited' && examDone

  const verCfg  = VER[s.verification_status]  ?? VER['pending']!
  const examCfg = EXAM[s.exam_status]          ?? EXAM['not_scheduled']!
  const resCfg  = RESULT[s.result_status]      ?? RESULT['awaited']!

  const unreadCount = (notifs as any[] ?? []).filter((n: any) => !n.is_read).length

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Welcome banner ── */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="relative">
          <p className="text-blue-200 text-sm">Welcome back,</p>
          <h1 className="text-2xl font-bold mt-0.5">{s.full_name}</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="bg-white/20 text-xs px-3 py-1 rounded-full font-medium">{s.enrollment_number}</span>
            {s.course && <span className="bg-white/20 text-xs px-3 py-1 rounded-full">{(s.course as { name: string }).name}</span>}
            {s.department && <span className="bg-white/20 text-xs px-3 py-1 rounded-full">{(s.department as { name: string }).name}</span>}
            {s.enrollment_date && (
              <span className="bg-white/20 text-xs px-3 py-1 rounded-full">
                Enrolled: {new Date(s.enrollment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Admission Journey Timeline ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900">Admission Journey</h2>
            <p className="text-xs text-gray-400 mt-0.5">{s.admission_progress}% complete</p>
          </div>
          <Link href="/student/admission" className="text-xs text-blue-600 flex items-center gap-1 hover:underline font-medium">
            View details <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
            style={{ width: `${s.admission_progress}%` }}
          />
        </div>

        {/* Step timeline */}
        <div className="flex items-start">
          <TimelineStep step={1} label="Enrolled"     sub="Admission"             done={enrolled}    active={false} />
          <TimelineStep step={2} label="Docs Review"  sub={verCfg.label}          done={verDone}     active={verActive} />
          <TimelineStep step={3} label="Verified"     sub={verDone ? 'Done' : '—'} done={verDone}     active={false} />
          <TimelineStep step={4} label="Examination"  sub={examCfg.label}         done={examDone}    active={examActive} />
          <TimelineStep step={5} label="Result"       sub={resCfg.label}          done={resultDone}  active={resultActive} last />
        </div>
      </div>

      {/* ── Status cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Verification */}
        <Link href="/student/admission" className={`border rounded-2xl p-4 hover:shadow-md transition-shadow ${verCfg.cls}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Verification</p>
          <p className="text-base font-bold mt-1 capitalize">{verCfg.label}</p>
          <div className="mt-2">
            {verDone ? <CheckCircle2 className="h-5 w-5" /> : verActive ? <Clock className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </div>
        </Link>
        {/* Exam */}
        <Link href="/student/admission" className={`border rounded-2xl p-4 hover:shadow-md transition-shadow ${examCfg.cls}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Exam Status</p>
          <p className="text-base font-bold mt-1 capitalize">{examCfg.label.replace(/_/g, ' ')}</p>
          <div className="mt-2">
            {examDone ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </div>
        </Link>
        {/* Result */}
        <Link href="/student/admission" className={`border rounded-2xl p-4 hover:shadow-md transition-shadow ${resCfg.cls}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Result</p>
          <p className="text-base font-bold mt-1 capitalize">{resCfg.label}</p>
          <div className="mt-2">
            {resultDone ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </div>
        </Link>
        {/* Fee */}
        <Link href="/student/accounts" className={`border rounded-2xl p-4 hover:shadow-md transition-shadow ${pending > 0 ? 'text-red-600 bg-red-50 border-red-200' : 'text-green-600 bg-green-50 border-green-200'}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Fee Dues</p>
          <p className="text-base font-bold mt-1">{pending > 0 ? `₹${pending.toLocaleString('en-IN')}` : 'Clear'}</p>
          <div className="mt-2">
            {pending > 0 ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
        </Link>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'My Admission',    href: '/student/admission', icon: GraduationCap, color: 'text-blue-600',   bg: 'bg-blue-50',   ring: 'ring-blue-100' },
          { label: 'Accounts',        href: '/student/accounts',  icon: IndianRupee,   color: 'text-green-600',  bg: 'bg-green-50',  ring: 'ring-green-100' },
          { label: 'Study Materials', href: '/student/materials', icon: BookOpen,      color: 'text-purple-600', bg: 'bg-purple-50', ring: 'ring-purple-100' },
          { label: 'Help & Support',  href: '/student/support',   icon: HelpCircle,    color: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-100' },
          { label: 'My Profile',      href: '/student/profile',   icon: User,          color: 'text-indigo-600', bg: 'bg-indigo-50', ring: 'ring-indigo-100' },
        ].map(({ label, href, icon: Icon, color, bg, ring }) => (
          <Link
            key={href}
            href={href}
            className={`bg-white border border-gray-100 rounded-2xl p-4 flex flex-col items-center gap-2.5 hover:shadow-md hover:ring-2 ${ring} transition-all text-center group`}
          >
            <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <span className="text-xs font-semibold text-gray-700 leading-tight">{label}</span>
          </Link>
        ))}
      </div>

      {/* ── Notifications & Announcements ── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-500" />
              <h2 className="font-semibold text-gray-900">Notifications</h2>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </div>
            <Link href="/student/support" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {!(notifs as any[])?.length ? (
            <div className="px-5 py-8 text-center">
              <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(notifs as any[]).map((n: any) => (
                <div key={n.id} className={`px-4 py-3 flex gap-3 ${!n.is_read ? 'bg-blue-50/30' : ''}`}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${NOTIF_DOT[n.type] ?? 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold truncate ${!n.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                      {n.category && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-500">{n.category}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                    {n.file_url && (
                      <a href={n.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 mt-1 hover:underline">
                        <Paperclip className="h-3 w-3" /> Attachment
                      </a>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                    {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <h2 className="font-semibold text-gray-900">Announcements</h2>
            </div>
            <Link href="/student/support" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {!(announcements as any[])?.length ? (
            <div className="px-5 py-8 text-center">
              <FileText className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No announcements</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(announcements as any[]).map((a: any) => (
                <div key={a.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <p className="text-sm font-medium text-gray-800 leading-snug">{a.title}</p>
                  {a.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>}
                  <p className="text-xs text-gray-400 mt-1 capitalize">
                    {a.type} · {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Fee mini summary ── */}
      {s.total_fee && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-green-500" /> Fee Summary
            </h2>
            <Link href="/student/accounts" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Full details <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] text-gray-400">Total Fee</p>
              <p className="text-sm font-bold text-gray-800 mt-0.5">₹{s.total_fee.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-[11px] text-green-600">Paid</p>
              <p className="text-sm font-bold text-green-700 mt-0.5">₹{s.amount_paid.toLocaleString('en-IN')}</p>
            </div>
            <div className={`rounded-xl p-3 ${pending > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className={`text-[11px] ${pending > 0 ? 'text-red-600' : 'text-green-600'}`}>Pending</p>
              <p className={`text-sm font-bold mt-0.5 ${pending > 0 ? 'text-red-700' : 'text-green-700'}`}>
                {pending > 0 ? `₹${pending.toLocaleString('en-IN')}` : 'Nil'}
              </p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
              style={{ width: `${s.total_fee ? Math.min(100, Math.round((s.amount_paid / s.total_fee) * 100)) : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

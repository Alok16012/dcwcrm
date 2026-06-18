import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  GraduationCap, Wallet, BookOpen, HelpCircle, Bell,
  ChevronRight, CheckCircle2, Clock, AlertCircle, User,
  FileText, IndianRupee, ArrowRight, Paperclip, TrendingUp,
  CircleDot, Circle,
} from 'lucide-react'
import { StudentLifecycle, lifecycleProgress } from '@/components/shared/StudentLifecycle'

const VER: Record<string, { label: string; color: string; bg: string; border: string; done: boolean; active: boolean }> = {
  pending:   { label: 'Pending',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200', done: false, active: true },
  in_review: { label: 'In Review', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',  done: false, active: true },
  verified:  { label: 'Verified',  color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200',done: true,  active: false },
  rejected:  { label: 'Rejected',  color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',   done: false, active: false },
}
const EXAM: Record<string, { label: string; color: string; bg: string; border: string; done: boolean }> = {
  not_scheduled:  { label: 'Not Scheduled',  color: 'text-gray-600',   bg: 'bg-gray-50',    border: 'border-gray-200',   done: false },
  scheduled:      { label: 'Scheduled',      color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   done: false },
  completed:      { label: 'Completed',      color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200', done: true },
  result_awaited: { label: 'Result Awaited', color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  done: false },
  passed:         { label: 'Passed',         color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-200',done: true },
  failed:         { label: 'Failed',         color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    done: false },
}
const RESULT: Record<string, { label: string; color: string; bg: string; border: string; done: boolean }> = {
  awaited:  { label: 'Awaited',  color: 'text-gray-600',   bg: 'bg-gray-50',    border: 'border-gray-200',   done: false },
  declared: { label: 'Declared', color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-200', done: true },
  passed:   { label: 'Passed',   color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-200', done: true },
  failed:   { label: 'Failed',   color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',     done: false },
  re_appear:{ label: 'Re-Appear',color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200',  done: false },
}
const NOTIF_DOT: Record<string, string> = {
  info: 'bg-blue-500', success: 'bg-emerald-500', warning: 'bg-amber-500', alert: 'bg-red-500',
}
const NOTIF_BG: Record<string, string> = {
  info: 'bg-blue-500/10', success: 'bg-emerald-500/10', warning: 'bg-amber-500/10', alert: 'bg-red-500/10',
}

function TimelineStep({
  step, label, sub, done, active, last,
}: { step: number; label: string; sub: string; done: boolean; active: boolean; last?: boolean }) {
  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <div className="relative flex items-center w-full">
        <div className={`flex-1 h-[3px] rounded-full ${step === 1 ? 'opacity-0' : done ? 'bg-emerald-400' : active ? 'bg-blue-200' : 'bg-gray-100'}`} />
        <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 shrink-0 transition-all ${
          done   ? 'bg-emerald-500 shadow-emerald-200 shadow-md' :
          active ? 'bg-blue-600 shadow-blue-200 shadow-md ring-4 ring-blue-100' :
                   'bg-white border-2 border-gray-200'
        }`}>
          {done ? (
            <CheckCircle2 className="w-5 h-5 text-white" />
          ) : active ? (
            <Clock className="w-5 h-5 text-white" />
          ) : (
            <span className="text-xs font-bold text-gray-400">{step}</span>
          )}
        </div>
        <div className={`flex-1 h-[3px] rounded-full ${last ? 'opacity-0' : done ? 'bg-emerald-400' : 'bg-gray-100'}`} />
      </div>
      <p className={`text-[11px] font-bold mt-2 text-center leading-tight ${
        done ? 'text-emerald-700' : active ? 'text-blue-700' : 'text-gray-400'
      }`}>{label}</p>
      <p className={`text-[10px] text-center mt-0.5 ${
        done ? 'text-emerald-500' : active ? 'text-blue-500' : 'text-gray-300'
      }`}>{sub}</p>
    </div>
  )
}

function StatusCard({
  label, value, icon: Icon, color, bg, border, href,
}: { label: string; value: string; icon: any; color: string; bg: string; border: string; href: string }) {
  return (
    <Link href={href} className={`${bg} ${border} border rounded-2xl p-4 hover:shadow-md transition-all group`}>
      <div className="flex items-start justify-between mb-3">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${color} opacity-70`}>{label}</p>
        <div className={`w-8 h-8 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <p className={`text-lg font-extrabold ${color} leading-tight`}>{value}</p>
    </Link>
  )
}

export default async function StudentDashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/student/login')

  const { data: student } = await supabase
    .from('students')
    .select(`
      id, full_name, enrollment_number, status,
      verification_status, exam_status, result_status, admission_progress,
      portal_active, admit_card_url,
      total_fee, amount_paid, enrollment_date,
      course:courses(name), department:departments(name)
    `)
    .eq('portal_user_id', user.id)
    .single()

  if (!student) redirect('/student/login')

  const s = student as {
    id: string; full_name: string; enrollment_number: string; status: string;
    verification_status: string; exam_status: string; result_status: string;
    admission_progress: number; total_fee: number | null; amount_paid: number;
    enrollment_date: string | null; portal_active: boolean; admit_card_url: string | null;
    course: { name: string } | null; department: { name: string } | null;
  }

  const pending = (s.total_fee ?? 0) - s.amount_paid

  const db = supabase as any
  const [{ data: notifs }, { data: announcements }, { data: dispatches }] = await Promise.all([
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
    db.from('student_dispatches')
      .select('id')
      .eq('student_id', s.id)
      .eq('status', 'delivered')
      .limit(1),
  ])
  const isDispatched = ((dispatches as any[]) ?? []).length > 0

  const verDone    = s.verification_status === 'verified'
  const verActive  = ['pending', 'in_review'].includes(s.verification_status)
  const examDone   = ['completed', 'passed', 'failed'].includes(s.exam_status)
  const examActive = ['scheduled', 'result_awaited'].includes(s.exam_status)
  const resultDone = ['declared', 'passed', 'failed'].includes(s.result_status)
  const resultActive = s.result_status === 'awaited' && examDone

  // Progress from the shared lifecycle (same logic everywhere)
  const lifecyclePct = lifecycleProgress({
    verification_status: s.verification_status,
    exam_status: s.exam_status,
    result_status: s.result_status,
    enrollment_number: s.enrollment_number,
    portal_active: s.portal_active,
    admit_card_url: s.admit_card_url,
    dispatched: isDispatched,
  }).pct

  const verCfg  = VER[s.verification_status]  ?? VER['pending']!
  const examCfg = EXAM[s.exam_status]         ?? EXAM['not_scheduled']!
  const resCfg  = RESULT[s.result_status]     ?? RESULT['awaited']!
  const unreadCount = (notifs as any[] ?? []).filter((n: any) => !n.is_read).length

  const firstName = s.full_name.split(' ')[0]

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Welcome Banner */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
          backgroundSize: '22px 22px',
        }} />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
          <GraduationCap className="w-28 h-28 text-white" />
        </div>
        <div className="relative">
          <p className="text-blue-200 text-sm font-medium">Welcome back,</p>
          <h1 className="text-2xl font-extrabold mt-1 tracking-tight">{s.full_name}</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-xs px-3 py-1.5 rounded-full font-semibold">
              {s.enrollment_number}
            </span>
            {s.course && (
              <span className="bg-white/15 text-xs px-3 py-1.5 rounded-full">{(s.course as { name: string }).name}</span>
            )}
            {s.department && (
              <span className="bg-white/15 text-xs px-3 py-1.5 rounded-full">{(s.department as { name: string }).name}</span>
            )}
            {s.enrollment_date && (
              <span className="bg-white/15 text-xs px-3 py-1.5 rounded-full">
                Enrolled {new Date(s.enrollment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Admission Journey */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-gray-900 text-base">Admission Journey</h2>
          <Link href="/student/admission" className="text-xs text-blue-600 flex items-center gap-1 hover:underline font-semibold">
            View details <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-400">{lifecyclePct}% complete</p>
          <p className="text-xs font-semibold text-blue-600">{lifecyclePct === 100 ? 'Completed!' : 'In Progress'}</p>
        </div>

        {/* Unified lifecycle — same on student, associate & counselor pages */}
        <StudentLifecycle
          student={{
            verification_status: s.verification_status,
            exam_status: s.exam_status,
            result_status: s.result_status,
            enrollment_number: s.enrollment_number,
            portal_active: s.portal_active,
            admit_card_url: s.admit_card_url,
            dispatched: isDispatched,
          }}
          title="Admission Journey"
        />
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCard
          label="Verification"
          value={verCfg.label}
          icon={verDone ? CheckCircle2 : verActive ? Clock : AlertCircle}
          color={verCfg.color} bg={verCfg.bg} border={verCfg.border}
          href="/student/admission"
        />
        <StatusCard
          label="Exam Status"
          value={examCfg.label}
          icon={examDone ? CheckCircle2 : Clock}
          color={examCfg.color} bg={examCfg.bg} border={examCfg.border}
          href="/student/admission"
        />
        <StatusCard
          label="Result"
          value={resCfg.label}
          icon={resultDone ? CheckCircle2 : Clock}
          color={resCfg.color} bg={resCfg.bg} border={resCfg.border}
          href="/student/admission"
        />
        <StatusCard
          label="Fee Dues"
          value={pending > 0 ? `₹${pending.toLocaleString('en-IN')}` : 'Clear'}
          icon={pending > 0 ? AlertCircle : CheckCircle2}
          color={pending > 0 ? 'text-red-700' : 'text-emerald-700'}
          bg={pending > 0 ? 'bg-red-50' : 'bg-emerald-50'}
          border={pending > 0 ? 'border-red-200' : 'border-emerald-200'}
          href="/student/accounts"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'My Admission',    href: '/student/admission', icon: GraduationCap, color: 'text-blue-600',    bg: 'bg-blue-50',    hover: 'hover:bg-blue-100'    },
          { label: 'Accounts',        href: '/student/accounts',  icon: IndianRupee,   color: 'text-emerald-600', bg: 'bg-emerald-50', hover: 'hover:bg-emerald-100' },
          { label: 'Study Materials', href: '/student/materials', icon: BookOpen,      color: 'text-blue-600',  bg: 'bg-blue-50',  hover: 'hover:bg-blue-100'  },
          { label: 'Help & Support',  href: '/student/support',   icon: HelpCircle,    color: 'text-orange-600',  bg: 'bg-orange-50',  hover: 'hover:bg-orange-100'  },
          { label: 'My Profile',      href: '/student/profile',   icon: User,          color: 'text-indigo-600',  bg: 'bg-indigo-50',  hover: 'hover:bg-indigo-100'  },
        ].map(({ label, href, icon: Icon, color, bg, hover }) => (
          <Link
            key={href}
            href={href}
            className={`bg-white border border-gray-100 rounded-2xl p-3.5 flex flex-col items-center gap-2 hover:shadow-md hover:border-gray-200 transition-all text-center group`}
          >
            <div className={`w-12 h-12 ${bg} ${hover} rounded-xl flex items-center justify-center transition-colors`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <span className="text-[11px] font-semibold text-gray-600 leading-tight">{label}</span>
          </Link>
        ))}
      </div>

      {/* Notifications + Announcements */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-500" />
              <span className="font-semibold text-gray-900 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{unreadCount}</span>
              )}
            </div>
            <Link href="/student/support" className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {!(notifs as any[])?.length ? (
            <div className="px-5 py-10 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-400">No notifications yet</p>
              <p className="text-xs text-gray-300 mt-1">Updates from your counsellor will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(notifs as any[]).map((n: any) => (
                <div key={n.id} className={`px-4 py-3 flex gap-3 items-start ${!n.is_read ? 'bg-blue-50/40' : 'hover:bg-gray-50'} transition-colors`}>
                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5 ${NOTIF_BG[n.type] ?? 'bg-gray-100'}`}>
                    <div className={`w-2 h-2 rounded-full ${NOTIF_DOT[n.type] ?? 'bg-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold truncate ${!n.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                      {n.category && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded-md text-gray-500 font-medium">{n.category}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                    {n.file_url && (
                      <a href={n.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 mt-1.5 hover:underline font-medium">
                        <Paperclip className="h-3 w-3" /> Attachment
                      </a>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-300 shrink-0 mt-1 font-medium">
                    {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span className="font-semibold text-gray-900 text-sm">Announcements</span>
            </div>
            <Link href="/student/support" className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {!(announcements as any[])?.length ? (
            <div className="px-5 py-10 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-400">No announcements</p>
              <p className="text-xs text-gray-300 mt-1">Important notices will show here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(announcements as any[]).map((a: any) => (
                <div key={a.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{a.title}</p>
                  {a.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{a.body}</p>}
                  <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wide font-medium">
                    {a.type} · {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fee Summary */}
      {s.total_fee && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Wallet className="h-4 w-4 text-emerald-600" />
              </div>
              <h2 className="font-bold text-gray-900">Fee Summary</h2>
            </div>
            <Link href="/student/accounts" className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold">
              Full details <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-xl p-3.5">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Total Fee</p>
              <p className="text-base font-extrabold text-gray-800 mt-1">₹{s.total_fee.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3.5">
              <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">Paid</p>
              <p className="text-base font-extrabold text-emerald-700 mt-1">₹{s.amount_paid.toLocaleString('en-IN')}</p>
            </div>
            <div className={`rounded-xl p-3.5 ${pending > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${pending > 0 ? 'text-red-500' : 'text-emerald-600'}`}>Pending</p>
              <p className={`text-base font-extrabold mt-1 ${pending > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {pending > 0 ? `₹${pending.toLocaleString('en-IN')}` : 'Nil'}
              </p>
            </div>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${s.total_fee ? Math.min(100, Math.round((s.amount_paid / s.total_fee) * 100)) : 0}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <p className="text-[10px] text-gray-400">0%</p>
            <p className="text-[10px] text-gray-400 font-medium">
              {s.total_fee ? Math.min(100, Math.round((s.amount_paid / s.total_fee) * 100)) : 0}% paid
            </p>
            <p className="text-[10px] text-gray-400">100%</p>
          </div>
        </div>
      )}
    </div>
  )
}

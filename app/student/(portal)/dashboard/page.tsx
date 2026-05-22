import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, Wallet, BookOpen, HelpCircle, Bell, ChevronRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

export default async function StudentDashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/student/login')

  const { data: student } = await supabase
    .from('students')
    .select(`
      id, full_name, enrollment_number, status,
      verification_status, exam_status, result_status, admission_progress,
      total_fee, amount_paid,
      course:courses(name), department:departments(name), sub_section:department_sub_sections(name)
    `)
    .eq('portal_user_id', user.id)
    .single()

  if (!student) redirect('/student/login')

  const s = student as {
    id: string; full_name: string; enrollment_number: string; status: string;
    verification_status: string; exam_status: string; result_status: string;
    admission_progress: number; total_fee: number | null; amount_paid: number;
    course: { name: string } | null; department: { name: string } | null; sub_section: { name: string } | null;
  }

  const pending = (s.total_fee ?? 0) - s.amount_paid

  const db = supabase as any
  const [{ data: notifications }, { data: announcements }] = await Promise.all([
    db.from('student_notifications').select('id, title, message, type, is_read, created_at')
      .eq('student_id', s.id).eq('is_read', false).order('created_at', { ascending: false }).limit(3),
    db.from('student_announcements').select('id, title, type, created_at')
      .eq('is_active', true).order('created_at', { ascending: false }).limit(3),
  ])

  const notifTypeColor: Record<string, string> = {
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    alert: 'bg-red-50 border-red-200 text-red-700',
  }

  const statusIcon: Record<string, React.ReactNode> = {
    verified: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    pending: <Clock className="h-4 w-4 text-yellow-500" />,
    in_review: <Clock className="h-4 w-4 text-blue-500" />,
    rejected: <AlertCircle className="h-4 w-4 text-red-500" />,
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white">
        <p className="text-blue-100 text-sm">Welcome back,</p>
        <h1 className="text-2xl font-bold mt-0.5">{s.full_name}</h1>
        <div className="flex flex-wrap gap-3 mt-3">
          <span className="bg-white/20 text-xs px-3 py-1 rounded-full font-medium">{s.enrollment_number}</span>
          {s.course && <span className="bg-white/20 text-xs px-3 py-1 rounded-full">{s.course.name}</span>}
          {s.department && <span className="bg-white/20 text-xs px-3 py-1 rounded-full">{s.department.name}</span>}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Admission Progress', value: `${s.admission_progress}%`, color: 'blue', href: '/student/admission' },
          { label: 'Verification', value: s.verification_status.replace('_', ' '), color: s.verification_status === 'verified' ? 'green' : 'yellow', href: '/student/admission' },
          { label: 'Fees Paid', value: `₹${s.amount_paid.toLocaleString('en-IN')}`, color: 'indigo', href: '/student/accounts' },
          { label: 'Pending Dues', value: pending > 0 ? `₹${pending.toLocaleString('en-IN')}` : 'Clear', color: pending > 0 ? 'red' : 'green', href: '/student/accounts' },
        ].map(({ label, value, color, href }) => (
          <Link key={label} href={href} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4 hover:shadow-md transition-shadow`}>
            <p className={`text-xs text-${color}-600 font-medium`}>{label}</p>
            <p className={`text-lg font-bold text-${color}-700 mt-1 capitalize`}>{value}</p>
          </Link>
        ))}
      </div>

      {/* Admission progress bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Admission Progress</h2>
          <Link href="/student/admission" className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
            View details <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
            style={{ width: `${s.admission_progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-gray-500">Started</span>
          <span className="text-xs font-semibold text-blue-700">{s.admission_progress}% Complete</span>
          <span className="text-xs text-gray-500">Done</span>
        </div>

        {/* Status row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Verification', value: s.verification_status },
            { label: 'Exam', value: s.exam_status },
            { label: 'Result', value: s.result_status },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <div className="flex items-center justify-center gap-1">
                {statusIcon[value] ?? <Clock className="h-4 w-4 text-gray-400" />}
                <span className="text-xs font-semibold text-gray-700 capitalize">{value.replace(/_/g, ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'My Admission', href: '/student/admission', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Accounts', href: '/student/accounts', icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Study Materials', href: '/student/materials', icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Help & Support', href: '/student/support', icon: HelpCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(({ label, href, icon: Icon, color, bg }) => (
          <Link
            key={href}
            href={href}
            className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col items-center gap-2 hover:shadow-md transition-all text-center"
          >
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <span className="text-xs font-semibold text-gray-700">{label}</span>
          </Link>
        ))}
      </div>

      {/* Notifications & Announcements */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-500" /> Notifications
            </h2>
            <Link href="/student/support" className="text-xs text-blue-600 hover:underline">See all</Link>
          </div>
          {!notifications?.length ? (
            <p className="text-sm text-gray-400 text-center py-4">No new notifications</p>
          ) : (
            <div className="space-y-2">
              {(notifications as any[]).map((n: any) => (
                <div key={n.id} className={`border rounded-xl p-3 text-sm ${notifTypeColor[n.type] ?? 'bg-gray-50 border-gray-200'}`}>
                  <p className="font-semibold text-xs">{n.title}</p>
                  <p className="mt-0.5 text-xs opacity-80 line-clamp-2">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" /> Announcements
            </h2>
            <Link href="/student/support" className="text-xs text-blue-600 hover:underline">See all</Link>
          </div>
          {!announcements?.length ? (
            <p className="text-sm text-gray-400 text-center py-4">No announcements</p>
          ) : (
            <div className="space-y-2">
              {(announcements as any[]).map((a: any) => (
                <div key={a.id} className="border border-gray-100 rounded-xl p-3 hover:bg-gray-50 transition-colors">
                  <p className="text-sm font-medium text-gray-800">{a.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{a.type} &middot; {new Date(a.created_at).toLocaleDateString('en-IN')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

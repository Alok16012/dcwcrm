import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock, XCircle, Download, FileText, CreditCard, GraduationCap, Award } from 'lucide-react'

export default async function AdmissionPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/student/login')

  const { data: student } = await supabase
    .from('students')
    .select(`
      id, full_name, enrollment_number, enrollment_date, status, mode,
      verification_status, exam_status, result_status, admission_progress,
      admit_card_url, enrollment_card_url, id_card_url, marksheet_url, certificate_url,
      university_name, board_name,
      course:courses(name), sub_course:sub_courses(name),
      department:departments(name), sub_section:department_sub_sections(name),
      session:sessions(name)
    `)
    .eq('portal_user_id', user.id)
    .single()

  if (!student) redirect('/student/login')

  const s = student as {
    id: string; full_name: string; enrollment_number: string; enrollment_date: string | null;
    status: string; mode: string | null; verification_status: string; exam_status: string;
    result_status: string; admission_progress: number;
    admit_card_url: string | null; enrollment_card_url: string | null;
    id_card_url: string | null; marksheet_url: string | null; certificate_url: string | null;
    university_name: string | null; board_name: string | null;
    course: { name: string } | null; sub_course: { name: string } | null;
    department: { name: string } | null; sub_section: { name: string } | null;
    session: { name: string } | null;
  }

  const timeline = [
    { step: 'Admission Received', done: true, desc: 'Your admission form has been received.' },
    { step: 'Documents Submitted', done: true, desc: 'Required documents have been submitted.' },
    { step: 'Verification', done: s.verification_status === 'verified', inProgress: s.verification_status === 'in_review', desc: `Status: ${s.verification_status.replace('_', ' ')}` },
    { step: 'Enrollment Confirmed', done: s.admission_progress >= 60, desc: 'Enrollment number assigned.' },
    { step: 'Exam Scheduled', done: s.exam_status !== 'not_scheduled', inProgress: s.exam_status === 'scheduled', desc: `Exam: ${s.exam_status.replace(/_/g, ' ')}` },
    { step: 'Result Declared', done: s.result_status !== 'awaited', desc: `Result: ${s.result_status.replace(/_/g, ' ')}` },
    { step: 'Marksheet / Certificate', done: !!s.marksheet_url || !!s.certificate_url, desc: 'Marksheet & certificate dispatch.' },
  ]

  const verColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    in_review: 'bg-blue-100 text-blue-800 border-blue-200',
    verified: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
  }

  const docs = [
    { label: 'Admit Card', url: s.admit_card_url, icon: FileText },
    { label: 'Enrollment Card', url: s.enrollment_card_url, icon: CreditCard },
    { label: 'ID Card', url: s.id_card_url, icon: CreditCard },
    { label: 'Marksheet', url: s.marksheet_url, icon: Award },
    { label: 'Certificate', url: s.certificate_url, icon: GraduationCap },
  ].filter(d => d.url)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Admission Status</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track your complete admission journey</p>
      </div>

      {/* Progress */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-blue-100 text-sm">Overall Progress</p>
            <p className="text-3xl font-extrabold mt-1">{s.admission_progress}%</p>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium border ${verColor[s.verification_status] ?? 'bg-white/20 text-white border-white/20'}`}>
            {s.verification_status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
        </div>
        <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all"
            style={{ width: `${s.admission_progress}%` }}
          />
        </div>
      </div>

      {/* Enrollment details */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">Enrollment Details</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {[
            { label: 'Full Name', value: s.full_name },
            { label: 'Enrollment No.', value: s.enrollment_number },
            { label: 'Course', value: s.course?.name ?? '—' },
            { label: 'Standard / Level', value: s.sub_course?.name ?? '—' },
            { label: 'University / Board', value: s.university_name ?? s.sub_section?.name ?? '—' },
            { label: 'Board Name', value: s.board_name ?? s.department?.name ?? '—' },
            { label: 'Session', value: s.session?.name ?? '—' },
            { label: 'Mode', value: s.mode?.replace('_', ' ') ?? '—' },
            { label: 'Enrollment Date', value: s.enrollment_date ? new Date(s.enrollment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
            { label: 'Status', value: s.status },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-sm font-medium text-gray-800 capitalize">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Verification', value: s.verification_status, icon: CheckCircle2 },
          { label: 'Exam', value: s.exam_status, icon: Clock },
          { label: 'Result', value: s.result_status, icon: Award },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
            <Icon className="h-6 w-6 mx-auto text-blue-500 mb-2" />
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-sm font-bold text-gray-800 capitalize">{value.replace(/_/g, ' ')}</p>
          </div>
        ))}
      </div>

      {/* Documents */}
      {docs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Download className="h-4 w-4 text-blue-500" /> My Documents
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {docs.map(({ label, url, icon: Icon }) => (
              <a
                key={label}
                href={url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all group"
              >
                <div className="w-9 h-9 bg-blue-50 group-hover:bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700">{label}</p>
                  <p className="text-xs text-blue-500 flex items-center gap-1">
                    <Download className="h-3 w-3" /> Download
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-5">Admission Timeline</h2>
        <div className="relative">
          <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-gray-100" />
          <div className="space-y-5">
            {timeline.map(({ step, done, inProgress, desc }) => (
              <div key={step} className="flex gap-4 relative">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${done ? 'bg-green-500' : inProgress ? 'bg-blue-500' : 'bg-gray-200'}`}>
                  {done ? <CheckCircle2 className="h-4 w-4 text-white" /> : inProgress ? <Clock className="h-4 w-4 text-white" /> : <div className="w-2 h-2 bg-gray-400 rounded-full" />}
                </div>
                <div className="pb-1">
                  <p className={`text-sm font-semibold ${done ? 'text-green-700' : inProgress ? 'text-blue-700' : 'text-gray-400'}`}>{step}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

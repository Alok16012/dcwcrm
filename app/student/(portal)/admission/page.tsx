'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Clock, Upload, Download, X, AlertCircle, FileText, GraduationCap } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

const DOC_SLOTS = [
  { key: 'admit_card_url',      label: 'Admit Card',      short: 'AC', color: 'blue' },
  { key: 'enrollment_card_url', label: 'Enrollment Card', short: 'EC', color: 'purple' },
  { key: 'id_card_url',         label: 'ID Card',         short: 'ID', color: 'orange' },
  { key: 'marksheet_url',       label: 'Marksheet',       short: 'MK', color: 'teal' },
  { key: 'certificate_url',     label: 'Certificate',     short: 'CR', color: 'green' },
] as const

type DocKey = typeof DOC_SLOTS[number]['key']

const STATUS_COLOR: Record<string, { cls: string; label: string }> = {
  pending:        { cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Pending' },
  in_review:      { cls: 'bg-blue-100 text-blue-700 border-blue-200',       label: 'In Review' },
  verified:       { cls: 'bg-green-100 text-green-700 border-green-200',    label: 'Verified' },
  rejected:       { cls: 'bg-red-100 text-red-700 border-red-200',          label: 'Rejected' },
  not_scheduled:  { cls: 'bg-gray-100 text-gray-500 border-gray-200',       label: 'Not Scheduled' },
  scheduled:      { cls: 'bg-blue-100 text-blue-700 border-blue-200',       label: 'Scheduled' },
  completed:      { cls: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Completed' },
  result_awaited: { cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Result Awaited' },
  passed:         { cls: 'bg-green-100 text-green-700 border-green-200',    label: 'Passed' },
  failed:         { cls: 'bg-red-100 text-red-700 border-red-200',          label: 'Failed' },
  awaited:        { cls: 'bg-gray-100 text-gray-500 border-gray-200',       label: 'Awaited' },
  declared:       { cls: 'bg-green-100 text-green-700 border-green-200',    label: 'Declared' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLOR[status] ?? { cls: 'bg-gray-100 text-gray-500 border-gray-200', label: status }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

interface TimelineStep {
  id: string
  label: string
  description: string
  done: boolean
  active: boolean
  date?: string | null
}

function AdmissionTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-100" />
      <div className="space-y-0">
        {steps.map((step, i) => (
          <div key={step.id} className="flex gap-4 relative">
            {/* Circle */}
            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
              step.done
                ? 'bg-green-500 border-green-500 text-white'
                : step.active
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'bg-white border-gray-300 text-gray-400'
            }`}>
              {step.done ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : step.active ? (
                <Clock className="w-4 h-4" />
              ) : (
                <span className="text-xs font-bold">{i + 1}</span>
              )}
            </div>
            {/* Content */}
            <div className={`flex-1 pb-6 ${i === steps.length - 1 ? 'pb-0' : ''}`}>
              <div className={`rounded-2xl border p-3.5 ${
                step.done   ? 'bg-green-50 border-green-200' :
                step.active ? 'bg-blue-50 border-blue-200' :
                              'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm font-bold ${step.done ? 'text-green-800' : step.active ? 'text-blue-800' : 'text-gray-500'}`}>
                      {step.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${step.done ? 'text-green-600' : step.active ? 'text-blue-600' : 'text-gray-400'}`}>
                      {step.description}
                    </p>
                  </div>
                  {step.date && (
                    <p className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                      {format(new Date(step.date), 'd MMM yyyy')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdmissionPage() {
  const supabase = createClient() as any
  const [student, setStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploads, setUploads] = useState<any[]>([])
  const [tab, setTab] = useState<'overview' | 'documents' | 'uploads'>('overview')

  // Upload modal
  const [uploadDoc, setUploadDoc] = useState<{ key: DocKey; label: string } | null>(null)
  const [remarks, setRemarks] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/student/login'; return }

      const { data: s } = await supabase
        .from('students')
        .select(`id, full_name, enrollment_number, enrollment_date, status,
          verification_status, exam_status, result_status, admission_progress,
          admit_card_url, enrollment_card_url, id_card_url, marksheet_url, certificate_url,
          total_fee, amount_paid,
          course:courses(name), department:departments(name), session:sessions(name),
          sub_section:department_sub_sections(name)`)
        .eq('portal_user_id', user.id)
        .single()

      if (!s) { window.location.href = '/student/login'; return }
      setStudent(s)

      const { data: u } = await supabase
        .from('student_uploads')
        .select('*')
        .eq('student_id', s.id)
        .order('uploaded_at', { ascending: false })
      setUploads(u ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleUpload(file: File) {
    if (!uploadDoc || !student) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `student-self/${student.id}/${uploadDoc.key}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('student-documents').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('student-documents').getPublicUrl(path)
      const url = urlData.publicUrl
      const { data: inserted } = await supabase.from('student_uploads').insert({
        student_id: student.id,
        document_type: uploadDoc.key,
        file_url: url,
        remarks: remarks.trim() || null,
      }).select('*').single()
      setUploads((prev: any[]) => [inserted, ...prev])
      toast.success(`${uploadDoc.label} uploaded`)
      setUploadDoc(null)
      setRemarks('')
    } catch (e: any) {
      toast.error('Upload failed: ' + (e?.message ?? ''))
    } finally {
      setUploading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )
  if (!student) return null

  // Build timeline steps
  const ver = student.verification_status
  const exam = student.exam_status
  const result = student.result_status

  const timelineSteps: TimelineStep[] = [
    {
      id: 'enrolled',
      label: 'Admission Enrolled',
      description: student.enrollment_date
        ? `Enrolled on ${format(new Date(student.enrollment_date), 'd MMMM yyyy')}`
        : 'Your admission has been registered',
      done: true,
      active: false,
      date: student.enrollment_date,
    },
    {
      id: 'docs',
      label: 'Document Submission',
      description: ver === 'pending' ? 'Awaiting document review by institution' : 'Documents received and under review',
      done: ['in_review', 'verified'].includes(ver),
      active: ver === 'pending',
    },
    {
      id: 'verification',
      label: 'Verification',
      description: ver === 'verified' ? 'Your documents have been verified' : ver === 'rejected' ? 'Documents need correction — contact counsellor' : 'Documents are being verified by the team',
      done: ver === 'verified',
      active: ver === 'in_review',
    },
    {
      id: 'exam',
      label: 'Examination',
      description: exam === 'not_scheduled' ? 'Exam will be scheduled after verification' :
                   exam === 'scheduled'     ? 'Your exam has been scheduled — check for details' :
                   exam === 'completed'     ? 'Examination completed successfully' :
                   exam === 'result_awaited'? 'Exam done — result is being processed' :
                   exam === 'passed'        ? 'Exam passed!' :
                   exam === 'failed'        ? 'Exam result: Failed' : '',
      done: ['completed', 'passed', 'failed', 'result_awaited'].includes(exam),
      active: exam === 'scheduled',
    },
    {
      id: 'result',
      label: 'Result Declaration',
      description: result === 'awaited'  ? 'Result is being processed' :
                   result === 'declared' ? 'Result has been declared' :
                   result === 'passed'   ? 'Congratulations! You have passed' :
                   result === 'failed'   ? 'Result: Not passed — contact counsellor' :
                                           'Result will be declared after examination',
      done: ['declared', 'passed', 'failed'].includes(result),
      active: result === 'awaited' && ['completed', 'result_awaited'].includes(exam),
    },
  ]

  const infoRows = [
    { label: 'Full Name',       value: student.full_name },
    { label: 'Enrollment No.',  value: student.enrollment_number },
    { label: 'Course',          value: student.course?.name ?? '—' },
    { label: 'Department',      value: student.department?.name ?? '—' },
    { label: 'Sub-Section',     value: student.sub_section?.name ?? '—' },
    { label: 'Session',         value: student.session?.name ?? '—' },
    { label: 'Enrollment Date', value: student.enrollment_date ? format(new Date(student.enrollment_date), 'd MMMM yyyy') : '—' },
    { label: 'Status',          value: student.status },
  ]

  const TABS = [
    { key: 'overview',   label: 'Overview & Timeline' },
    { key: 'documents',  label: 'Documents' },
    { key: 'uploads',    label: `My Uploads${uploads.length > 0 ? ` (${uploads.length})` : ''}` },
  ] as const

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-600" /> My Admission
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Your enrollment details and admission journey</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-blue-700">{student.admission_progress}%</p>
          <p className="text-xs text-gray-400">Complete</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
          style={{ width: `${student.admission_progress}%` }}
        />
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-500 font-medium self-center">Status:</span>
        <StatusBadge status={student.verification_status} />
        <StatusBadge status={student.exam_status} />
        <StatusBadge status={student.result_status} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Admission Timeline */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-4">Admission Journey</h2>
            <AdmissionTimeline steps={timelineSteps} />
          </div>

          {/* Enrollment Details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/50">
              <h2 className="font-semibold text-gray-900 text-sm">Enrollment Details</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {infoRows.map(({ label, value }) => (
                <div key={label} className="flex px-5 py-3">
                  <p className="text-xs font-semibold text-gray-400 w-36 shrink-0">{label}</p>
                  <p className="text-sm font-medium text-gray-800 capitalize flex-1">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed status */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Verification', status: student.verification_status },
              { label: 'Exam Status',  status: student.exam_status },
              { label: 'Result',       status: student.result_status },
            ].map(({ label, status }) => {
              const cfg = STATUS_COLOR[status] ?? { cls: 'bg-gray-100 text-gray-500 border-gray-200', label: status }
              return (
                <div key={label} className={`rounded-2xl border p-4 ${cfg.cls}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</p>
                  <p className="font-bold text-sm capitalize">{cfg.label.replace(/_/g, ' ')}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Documents Tab ── */}
      {tab === 'documents' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
            Documents below are issued by the institution. Once uploaded, you can download them anytime.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DOC_SLOTS.map(({ key, label, short }) => {
              const url = student[key]
              return (
                <div key={key} className={`rounded-2xl border p-4 flex items-center gap-4 ${url ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${url ? 'bg-green-100 text-green-700' : 'bg-white text-gray-300 border border-gray-200'}`}>
                    {short}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    {url ? (
                      <p className="text-xs text-green-600 font-medium mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Available
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Not issued yet
                      </p>
                    )}
                  </div>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── My Uploads Tab ── */}
      {tab === 'uploads' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">{uploads.length} document{uploads.length !== 1 ? 's' : ''} submitted</p>
            <button
              onClick={() => { setUploadDoc({ key: 'admit_card_url', label: 'Document' }); setRemarks('') }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Upload Document
            </button>
          </div>

          {uploads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
              <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No uploads yet</p>
              <p className="text-sm text-gray-400 mt-1">Upload documents like your Aadhar, 10th marksheet, etc.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {uploads.map((u: any) => (
                <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 capitalize">{u.document_type.replace(/_url$/, '').replace(/_/g, ' ')}</p>
                    {u.remarks && <p className="text-xs text-gray-500 mt-0.5">{u.remarks}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(u.uploaded_at), 'd MMM yyyy, h:mm a')}
                    </p>
                  </div>
                  <a
                    href={u.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" /> View
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Upload Modal ── */}
      {uploadDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setUploadDoc(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">Upload Document</h3>
                <p className="text-xs text-gray-400 mt-0.5">PDF, JPG, PNG — max 10 MB</p>
              </div>
              <button onClick={() => setUploadDoc(null)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-blue-400 hover:bg-blue-50/40 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Upload className="w-7 h-7 text-gray-300" />
                <span className="text-sm font-medium text-gray-500">{uploading ? 'Uploading…' : 'Click to choose file'}</span>
              </button>
              <input
                type="text"
                placeholder="Remarks (e.g. 10th marksheet, Aadhar card…)"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
              />
              <p className="text-[11px] text-gray-400 text-center">Date & time captured automatically.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Clock, Upload, Download, X } from 'lucide-react'
import { toast } from 'sonner'

const DOC_SLOTS = [
  { key: 'admit_card_url',      label: 'Admit Card' },
  { key: 'enrollment_card_url', label: 'Enrollment Card' },
  { key: 'id_card_url',         label: 'ID Card' },
  { key: 'marksheet_url',       label: 'Marksheet' },
  { key: 'certificate_url',     label: 'Certificate' },
] as const

type DocKey = typeof DOC_SLOTS[number]['key']

const STATUS_COLOR: Record<string, string> = {
  pending:        'bg-yellow-100 text-yellow-700',
  in_review:      'bg-blue-100 text-blue-700',
  verified:       'bg-green-100 text-green-700',
  rejected:       'bg-red-100 text-red-700',
  not_scheduled:  'bg-gray-100 text-gray-500',
  scheduled:      'bg-blue-100 text-blue-700',
  completed:      'bg-indigo-100 text-indigo-700',
  result_awaited: 'bg-yellow-100 text-yellow-700',
  passed:         'bg-green-100 text-green-700',
  failed:         'bg-red-100 text-red-700',
  awaited:        'bg-gray-100 text-gray-500',
  declared:       'bg-indigo-100 text-indigo-700',
}

export default function AdmissionPage() {
  const supabase = createClient() as any
  const [student, setStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploads, setUploads] = useState<any[]>([])

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
          course:courses(name), department:departments(name), session:sessions(name)`)
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

      setUploads(prev => [inserted, ...prev])
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

  const infoRows = [
    { label: 'Full Name', value: student.full_name },
    { label: 'Enrollment No.', value: student.enrollment_number },
    { label: 'Course', value: student.course?.name ?? '—' },
    { label: 'Department', value: student.department?.name ?? '—' },
    { label: 'Session', value: student.session?.name ?? '—' },
    { label: 'Enrollment Date', value: student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
    { label: 'Status', value: student.status },
  ]

  const statusRows = [
    { label: 'Verification', value: student.verification_status },
    { label: 'Exam', value: student.exam_status },
    { label: 'Result', value: student.result_status },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Admission</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your enrollment details and documents</p>
      </div>

      {/* Info table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {infoRows.map(({ label, value }) => (
              <tr key={label}>
                <td className="px-4 py-3 text-xs font-semibold text-gray-400 w-40">{label}</td>
                <td className="px-4 py-3 font-medium text-gray-800 capitalize">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status + progress */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400">Admission Progress</span>
            <span className="text-xs font-bold text-blue-600">{student.admission_progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${student.admission_progress}%` }} />
          </div>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {statusRows.map(({ label, value }) => (
              <tr key={label}>
                <td className="px-4 py-3 text-xs font-semibold text-gray-400 w-40">{label}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${STATUS_COLOR[value] ?? 'bg-gray-100 text-gray-500'}`}>
                    {value.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Documents from admin */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <h2 className="text-sm font-bold text-gray-800">Documents</h2>
          <p className="text-xs text-gray-400 mt-0.5">Issued by institution</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {DOC_SLOTS.map(({ key, label }) => {
              const url = student[key]
              return (
                <tr key={key}>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-400 w-40">{label}</td>
                  <td className="px-4 py-3">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-gray-300">
                        <Clock className="w-3.5 h-3.5" /> Not issued yet
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {url && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Student uploads */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800">My Uploads</h2>
            <p className="text-xs text-gray-400 mt-0.5">Documents submitted by you</p>
          </div>
          <button
            onClick={() => { setUploadDoc({ key: 'admit_card_url', label: 'Document' }); setRemarks('') }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
        </div>
        {uploads.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">No uploads yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Document</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Remarks</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Uploaded</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-widest">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {uploads.map((u: any) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 text-xs font-medium text-gray-700 capitalize">{u.document_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{u.remarks ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(u.uploaded_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={u.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 justify-end">
                      <Download className="w-3 h-3" /> View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Upload Modal */}
      {uploadDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setUploadDoc(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Upload Document</h3>
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
                <span className="text-xs text-gray-400">PDF · JPG · PNG — max 10 MB</span>
              </button>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. 10th marksheet, Aadhar card…"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
                />
              </div>

              <p className="text-[11px] text-gray-400 text-center">Date & time captured automatically.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

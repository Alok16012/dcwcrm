'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Search, Upload, CheckCircle2, Clock, KeyRound, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Student {
  id: string
  full_name: string
  phone: string
  enrollment_number: string
  status: string
  portal_active: boolean
  portal_username: string | null
  portal_temp_password: string | null
  verification_status: string
  exam_status: string
  result_status: string
  admission_progress: number
  admit_card_url: string | null
  enrollment_card_url: string | null
  id_card_url: string | null
  marksheet_url: string | null
  certificate_url: string | null
  course?: { name: string }
}

const DOC_FIELDS = [
  { key: 'admit_card_url',      label: 'Admit Card',      short: 'AC' },
  { key: 'enrollment_card_url', label: 'Enrollment Card', short: 'EC' },
  { key: 'id_card_url',         label: 'ID Card',         short: 'ID' },
  { key: 'marksheet_url',       label: 'Marksheet',       short: 'MK' },
  { key: 'certificate_url',     label: 'Certificate',     short: 'CR' },
] as const

type DocKey = typeof DOC_FIELDS[number]['key']

const VER_COLOR: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  verified:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
}
const EXAM_COLOR: Record<string, string> = {
  not_scheduled:  'bg-gray-100 text-gray-500',
  scheduled:      'bg-blue-100 text-blue-700',
  completed:      'bg-indigo-100 text-indigo-700',
  result_awaited: 'bg-yellow-100 text-yellow-700',
  passed:         'bg-green-100 text-green-700',
  failed:         'bg-red-100 text-red-700',
}

function Pill({ val, map }: { val: string; map: Record<string, string> }) {
  const cls = map[val] ?? 'bg-gray-100 text-gray-500'
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{val.replace(/_/g, ' ')}</span>
}

export function StudentPortalManager() {
  const supabase = createClient() as any
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Upload dialog
  const [uploadFor, setUploadFor] = useState<{ student: Student; docKey: DocKey; label: string } | null>(null)
  const [remarks, setRemarks] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Credentials dialog
  const [credFor, setCredFor] = useState<Student | null>(null)
  const [pass, setPass] = useState('')
  const [savingCred, setSavingCred] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select(`id, full_name, phone, enrollment_number, status,
        portal_active, portal_username, portal_temp_password,
        verification_status, exam_status, result_status, admission_progress,
        admit_card_url, enrollment_card_url, id_card_url, marksheet_url, certificate_url,
        course:courses(name)`)
      .neq('status', 'dropped')
      .order('full_name')
    setStudents((data ?? []) as Student[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const filtered = students.filter(s =>
    !search ||
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search) ||
    s.enrollment_number.toLowerCase().includes(search.toLowerCase())
  )

  async function handleUpload(file: File) {
    if (!uploadFor) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${uploadFor.student.id}/${uploadFor.docKey}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('student-documents').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('student-documents').getPublicUrl(path)
      const url = urlData.publicUrl

      await supabase.from('students').update({ [uploadFor.docKey]: url }).eq('id', uploadFor.student.id)

      if (remarks.trim()) {
        await supabase.from('student_uploads').insert({
          student_id: uploadFor.student.id,
          document_type: uploadFor.docKey,
          file_url: url,
          remarks: remarks.trim(),
        })
      }

      setStudents(prev => prev.map(s =>
        s.id === uploadFor.student.id ? { ...s, [uploadFor.docKey]: url } : s
      ))
      toast.success(`${uploadFor.label} uploaded`)
      setUploadFor(null)
      setRemarks('')
    } catch (e: any) {
      toast.error('Upload failed: ' + (e?.message ?? 'unknown'))
    } finally {
      setUploading(false)
    }
  }

  async function saveCredentials() {
    if (!credFor || pass.length < 6) { toast.error('Min 6 characters'); return }
    setSavingCred(true)
    try {
      const endpoint = credFor.portal_active ? '/api/students/reset-password' : '/api/students/create-credentials'
      const body = credFor.portal_active
        ? { student_id: credFor.id, new_password: pass }
        : { student_id: credFor.id, password: pass }
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(credFor.portal_active ? 'Password reset' : 'Portal access created')
      await load(); setCredFor(null); setPass('')
    } catch { toast.error('Failed') }
    finally { setSavingCred(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search student, phone, enrollment…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <span className="text-xs text-gray-400">{filtered.length} students</span>
      </div>

      {/* Excel-style table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80">
              {['Student', 'Course', 'Verification', 'Exam', 'Progress', 'Documents', 'Portal', 'Access'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">No students found</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">

                {/* Student */}
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900 text-[13px]">{s.full_name}</p>
                  <p className="text-[11px] text-gray-400 font-mono">{s.enrollment_number}</p>
                  <p className="text-[11px] text-gray-400">{s.phone}</p>
                </td>

                {/* Course */}
                <td className="px-4 py-3 text-[12px] text-gray-600 max-w-[120px]">
                  {(s.course as any)?.name ?? '—'}
                </td>

                {/* Verification */}
                <td className="px-4 py-3"><Pill val={s.verification_status} map={VER_COLOR} /></td>

                {/* Exam */}
                <td className="px-4 py-3"><Pill val={s.exam_status} map={EXAM_COLOR} /></td>

                {/* Progress */}
                <td className="px-4 py-3 min-w-[90px]">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${s.admission_progress}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-500 shrink-0">{s.admission_progress}%</span>
                  </div>
                </td>

                {/* Documents */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {DOC_FIELDS.map(({ key, label, short }) => {
                      const url = s[key]
                      return (
                        <div key={key} className="flex flex-col items-center gap-0.5">
                          <span className="text-[9px] text-gray-400 font-medium">{short}</span>
                          <div className="flex items-center gap-0.5">
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer" title={`View ${label}`}
                                className="w-6 h-6 rounded bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <span title={`${label} — not uploaded`} className="w-6 h-6 rounded bg-gray-50 text-gray-300 flex items-center justify-center">
                                <Clock className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <button
                              title={`Upload ${label}`}
                              onClick={() => { setUploadFor({ student: s, docKey: key, label }); setRemarks('') }}
                              className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                            >
                              <Upload className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </td>

                {/* Portal status */}
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.portal_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.portal_active ? 'Active' : 'Inactive'}
                  </span>
                  {s.portal_username && (
                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{s.portal_username}</p>
                  )}
                </td>

                {/* Access */}
                <td className="px-4 py-3">
                  <button
                    onClick={() => { setCredFor(s); setPass('') }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors"
                  >
                    <KeyRound className="w-3 h-3" />
                    {s.portal_active ? 'Reset' : 'Create'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Upload Dialog ── */}
      {uploadFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setUploadFor(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900 text-[15px]">Upload {uploadFor.label}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{uploadFor.student.full_name} · {uploadFor.student.enrollment_number}</p>
              </div>
              <button onClick={() => setUploadFor(null)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
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
                  placeholder="e.g. Original verified, issued by board…"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
                />
              </div>

              <p className="text-[11px] text-gray-400 text-center">Date & time captured automatically on upload.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Credentials Dialog ── */}
      {credFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setCredFor(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">{credFor.portal_active ? 'Reset Password' : 'Create Portal Access'}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{credFor.full_name}</p>
              </div>
              <button onClick={() => setCredFor(null)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {credFor.portal_username && (
                <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm">
                  <span className="text-gray-400 text-xs">Username: </span>
                  <span className="font-mono font-medium">{credFor.portal_username}</span>
                </div>
              )}
              <input
                type="text"
                placeholder="Set password (min 6 chars)"
                value={pass}
                onChange={e => setPass(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50"
              />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={saveCredentials} disabled={savingCred || pass.length < 6}>
                  {savingCred ? 'Saving…' : credFor.portal_active ? 'Reset Password' : 'Create Access'}
                </Button>
                <Button variant="outline" onClick={() => setCredFor(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

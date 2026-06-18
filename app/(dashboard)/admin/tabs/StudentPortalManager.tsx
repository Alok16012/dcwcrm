'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Search, Upload, CheckCircle2, Clock, KeyRound, X,
  Send, Plus, Paperclip, Bell, FileText, ShieldCheck,
  ChevronRight, ArrowLeft, Eye,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

// Display helper: ENR-873254X → DCW-873254
function fmtEnroll(n: string | null | undefined) {
  if (!n) return n
  if (n.startsWith('ENR-')) return 'DCW-' + n.slice(4).replace(/[^0-9]/g, '')
  return n
}

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

interface StudentNotification {
  id: string
  title: string
  message: string
  type: string
  category: string | null
  file_url: string | null
  is_read: boolean
  created_at: string
}

const DOC_FIELDS = [
  { key: 'admit_card_url',      label: 'Admit Card',      short: 'AC', color: 'blue' },
  { key: 'enrollment_card_url', label: 'Enrollment Card', short: 'EC', color: 'blue' },
  { key: 'id_card_url',         label: 'ID Card',         short: 'ID', color: 'orange' },
  { key: 'marksheet_url',       label: 'Marksheet',       short: 'MK', color: 'teal' },
  { key: 'certificate_url',     label: 'Certificate',     short: 'CR', color: 'green' },
] as const

type DocKey = typeof DOC_FIELDS[number]['key']

const DEFAULT_CATEGORIES = [
  'General Update', 'Fee Reminder', 'Exam Schedule',
  'Result', 'Document Ready', 'Holiday Notice', 'Urgent',
]

const NOTIF_TYPE_OPTS = [
  { value: 'info',    label: 'Info',    cls: 'bg-blue-100 text-blue-700' },
  { value: 'success', label: 'Success', cls: 'bg-green-100 text-green-700' },
  { value: 'warning', label: 'Warning', cls: 'bg-yellow-100 text-yellow-700' },
  { value: 'alert',   label: 'Alert',   cls: 'bg-red-100 text-red-700' },
]

function InitialAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export function StudentPortalManager() {
  const supabase = createClient() as any
  const [students, setStudents]   = useState<Student[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')

  const [selected, setSelected]         = useState<Student | null>(null)
  const [tab, setTab]                   = useState<'updates' | 'documents' | 'access'>('updates')
  const [notifications, setNotifications] = useState<StudentNotification[]>([])
  const [notifLoading, setNotifLoading] = useState(false)

  // Send-update form
  const [updateCategory, setUpdateCategory] = useState(DEFAULT_CATEGORIES[0])
  const [updateType,     setUpdateType]     = useState('info')
  const [updateTitle,    setUpdateTitle]    = useState('')
  const [updateMessage,  setUpdateMessage]  = useState('')
  const [updateFileUrl,  setUpdateFileUrl]  = useState<string | null>(null)
  const [uploadingFile,  setUploadingFile]  = useState(false)
  const [sending,        setSending]        = useState(false)
  const [customCats,     setCustomCats]     = useState<string[]>([])
  const [addingCat,      setAddingCat]      = useState(false)
  const [newCat,         setNewCat]         = useState('')
  const updateFileRef = useRef<HTMLInputElement>(null)

  // Document upload
  const [uploadingDoc,  setUploadingDoc]  = useState<DocKey | null>(null)
  const [pendingDocKey, setPendingDocKey] = useState<DocKey | null>(null)
  const docFileRef = useRef<HTMLInputElement>(null)

  // Credentials
  const [pass,       setPass]       = useState('')
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

  async function loadNotifications(studentId: string) {
    setNotifLoading(true)
    const { data } = await supabase
      .from('student_notifications')
      .select('id, title, message, type, category, file_url, is_read, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
    setNotifications((data ?? []) as StudentNotification[])
    setNotifLoading(false)
  }

  function openStudent(s: Student) {
    setSelected(s)
    setTab('updates')
    loadNotifications(s.id)
    resetUpdateForm()
  }

  function resetUpdateForm() {
    setUpdateCategory(DEFAULT_CATEGORIES[0])
    setUpdateType('info')
    setUpdateTitle('')
    setUpdateMessage('')
    setUpdateFileUrl(null)
  }

  const filtered = students.filter(s =>
    !search ||
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search) ||
    s.enrollment_number.toLowerCase().includes(search.toLowerCase()) ||
    (fmtEnroll(s.enrollment_number) ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // ── Send Update ──────────────────────────────────────────────
  async function sendUpdate() {
    if (!selected) return
    if (!updateTitle.trim()) { toast.error('Title is required'); return }
    if (!updateMessage.trim()) { toast.error('Message is required'); return }
    setSending(true)
    try {
      const { error } = await supabase.from('student_notifications').insert({
        student_id: selected.id,
        title:      updateTitle.trim(),
        message:    updateMessage.trim(),
        type:       updateType,
        category:   updateCategory,
        file_url:   updateFileUrl ?? null,
        is_read:    false,
      })
      if (error) throw error
      toast.success('Update sent!')
      resetUpdateForm()
      loadNotifications(selected.id)
    } catch (e: any) {
      toast.error('Failed: ' + (e?.message ?? 'unknown'))
    } finally {
      setSending(false)
    }
  }

  async function handleUpdateFileUpload(file: File) {
    setUploadingFile(true)
    try {
      const path = `updates/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error } = await supabase.storage.from('student-documents').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('student-documents').getPublicUrl(path)
      setUpdateFileUrl(urlData.publicUrl)
      toast.success('File attached')
    } catch (e: any) {
      toast.error('Upload failed: ' + (e?.message ?? 'unknown'))
    } finally {
      setUploadingFile(false)
    }
  }

  // ── Document Upload ──────────────────────────────────────────
  async function handleDocUpload(file: File, docKey: DocKey) {
    if (!selected) return
    setUploadingDoc(docKey)
    try {
      const ext = file.name.split('.').pop()
      const path = `${selected.id}/${docKey}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('student-documents').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('student-documents').getPublicUrl(path)
      const url = urlData.publicUrl
      await supabase.from('students').update({ [docKey]: url }).eq('id', selected.id)
      const updated = { ...selected, [docKey]: url }
      setSelected(updated)
      setStudents(prev => prev.map(s => s.id === selected.id ? { ...s, [docKey]: url } : s))
      toast.success(`${DOC_FIELDS.find(d => d.key === docKey)?.label} uploaded`)
    } catch (e: any) {
      toast.error('Upload failed: ' + (e?.message ?? 'unknown'))
    } finally {
      setUploadingDoc(null)
      setPendingDocKey(null)
    }
  }

  // ── Credentials ──────────────────────────────────────────────
  async function saveCredentials() {
    if (!selected || pass.length < 6) { toast.error('Min 6 characters'); return }
    setSavingCred(true)
    try {
      const endpoint = selected.portal_active ? '/api/students/reset-password' : '/api/students/create-credentials'
      const body = selected.portal_active
        ? { student_id: selected.id, new_password: pass }
        : { student_id: selected.id, password: pass }
      const res  = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(selected.portal_active ? 'Password reset' : 'Portal access created')
      await load()
      setPass('')
      const updated = students.find(s => s.id === selected.id)
      if (updated) setSelected(updated)
    } catch { toast.error('Failed') }
    finally { setSavingCred(false) }
  }

  const allCats = [...DEFAULT_CATEGORIES, ...customCats]

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 230px)', minHeight: '500px' }}>

      {/* ── Left: Student list ─────────────────────────────────── */}
      <div className={`flex flex-col gap-3 ${selected ? 'hidden md:flex w-72 flex-shrink-0' : 'flex-1'}`}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search name, phone, enrollment…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <span className="text-xs text-gray-400 shrink-0">{filtered.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No students found</div>
          ) : filtered.map(s => (
            <button
              key={s.id}
              onClick={() => openStudent(s)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${
                selected?.id === s.id
                  ? 'bg-blue-50 border-blue-200 shadow-sm'
                  : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
              }`}
            >
              <InitialAvatar name={s.full_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{s.full_name}</p>
                <p className="text-[11px] text-gray-400 font-mono truncate">{fmtEnroll(s.enrollment_number)}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                  s.portal_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {s.portal_active ? 'Live' : 'Off'}
                </span>
                <ChevronRight className="w-3 h-3 text-gray-300" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: Detail panel ────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-w-0">

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-blue-50 shrink-0">
            <button
              onClick={() => setSelected(null)}
              className="md:hidden w-7 h-7 rounded-lg hover:bg-white/80 flex items-center justify-center text-gray-500 mr-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <InitialAvatar name={selected.full_name} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 leading-tight">{selected.full_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="font-mono">{fmtEnroll(selected.enrollment_number)}</span>
                {(selected.course as any)?.name && <span> · {(selected.course as any).name}</span>}
                {selected.phone && <span> · {selected.phone}</span>}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${
              selected.portal_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {selected.portal_active ? 'Portal Active' : 'Portal Inactive'}
            </span>
            <button
              onClick={() => setSelected(null)}
              className="hidden md:flex w-7 h-7 rounded-lg hover:bg-white/80 items-center justify-center text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 shrink-0 bg-white">
            {([
              ['updates',   Bell,         'Updates',   notifications.filter(n => !n.is_read).length],
              ['documents', FileText,     'Documents', 0],
              ['access',    ShieldCheck,  'Access',    0],
            ] as const).map(([key, Icon, label, badge]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                  tab === key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge > 0 && (
                  <span className="ml-0.5 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab body */}
          <div className="flex-1 overflow-y-auto">

            {/* ── UPDATES TAB ── */}
            {tab === 'updates' && (
              <div className="flex flex-col h-full">

                {/* Send form */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/40 space-y-3 shrink-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Send Update</p>

                  {/* Category pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {allCats.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setUpdateCategory(cat)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          updateCategory === cat
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                    {!addingCat ? (
                      <button
                        onClick={() => setAddingCat(true)}
                        className="px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Category…"
                          value={newCat}
                          onChange={e => setNewCat(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newCat.trim()) {
                              setCustomCats(p => [...p, newCat.trim()])
                              setUpdateCategory(newCat.trim())
                              setNewCat('')
                              setAddingCat(false)
                            }
                            if (e.key === 'Escape') { setAddingCat(false); setNewCat('') }
                          }}
                          autoFocus
                          className="border border-blue-300 rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 w-28"
                        />
                        <button
                          onClick={() => {
                            if (newCat.trim()) { setCustomCats(p => [...p, newCat.trim()]); setUpdateCategory(newCat.trim()) }
                            setNewCat(''); setAddingCat(false)
                          }}
                          className="text-xs text-blue-600 font-medium px-1"
                        >Save</button>
                        <button onClick={() => { setAddingCat(false); setNewCat('') }} className="text-gray-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Type selector */}
                  <div className="flex gap-1.5">
                    {NOTIF_TYPE_OPTS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => setUpdateType(o.value)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          updateType === o.value ? o.cls + ' border-current' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>

                  {/* Title + message */}
                  <input
                    type="text"
                    placeholder="Title…"
                    value={updateTitle}
                    onChange={e => setUpdateTitle(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  />
                  <textarea
                    placeholder="Message details…"
                    value={updateMessage}
                    onChange={e => setUpdateMessage(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white resize-none"
                  />

                  {/* File + send row */}
                  <div className="flex items-center gap-2">
                    <input ref={updateFileRef} type="file" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUpdateFileUpload(f) }} />
                    {updateFileUrl ? (
                      <a href={updateFileUrl} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 font-medium hover:underline truncate">
                        <Paperclip className="w-3.5 h-3.5 shrink-0" /> File attached
                        <button className="ml-auto text-gray-400 hover:text-red-500" onClick={e => { e.preventDefault(); setUpdateFileUrl(null) }}>
                          <X className="w-3 h-3" />
                        </button>
                      </a>
                    ) : (
                      <button
                        onClick={() => updateFileRef.current?.click()}
                        disabled={uploadingFile}
                        className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {uploadingFile ? 'Uploading…' : 'Attach file'}
                      </button>
                    )}
                    <Button
                      onClick={sendUpdate}
                      disabled={sending || !updateTitle.trim() || !updateMessage.trim()}
                      className="ml-auto gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-9"
                      size="sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sending ? 'Sending…' : 'Send'}
                    </Button>
                  </div>
                </div>

                {/* Timeline */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {notifLoading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400 text-sm">Loading…</div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                      <Bell className="w-8 h-8 mb-2 text-gray-200" />
                      <p className="text-sm">No updates sent yet</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-[18px] top-4 bottom-4 w-px bg-gray-100" />
                      <div className="space-y-3">
                        {notifications.map(n => {
                          const typeInfo = NOTIF_TYPE_OPTS.find(o => o.value === n.type) ?? NOTIF_TYPE_OPTS[0]
                          return (
                            <div key={n.id} className="flex gap-3">
                              {/* Dot */}
                              <div className={`w-9 h-9 rounded-full border-2 border-white shadow-sm flex items-center justify-center shrink-0 z-10 ${typeInfo.cls}`}>
                                <Bell className="w-3.5 h-3.5" />
                              </div>
                              <div className={`flex-1 rounded-2xl border p-3.5 ${!n.is_read ? 'ring-1 ring-blue-200' : ''} ${
                                n.type === 'success' ? 'bg-green-50 border-green-100' :
                                n.type === 'warning' ? 'bg-yellow-50 border-yellow-100' :
                                n.type === 'alert'   ? 'bg-red-50 border-red-100' :
                                'bg-blue-50 border-blue-100'
                              }`}>
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                                    {n.category && (
                                      <span className="text-[10px] px-2 py-0.5 bg-white/80 border border-gray-200 rounded-full text-gray-500 font-medium">
                                        {n.category}
                                      </span>
                                    )}
                                    {!n.is_read && (
                                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                    )}
                                  </div>
                                  <p className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                                    {format(new Date(n.created_at), 'd MMM yyyy, h:mm a')}
                                  </p>
                                </div>
                                <p className="text-xs text-gray-600">{n.message}</p>
                                {n.file_url && (
                                  <a
                                    href={n.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-600 font-medium hover:underline underline-offset-2"
                                  >
                                    <Paperclip className="h-3 w-3" /> View attachment
                                  </a>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── DOCUMENTS TAB ── */}
            {tab === 'documents' && (
              <div className="p-5 space-y-3">
                <input
                  ref={docFileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f && pendingDocKey) handleDocUpload(f, pendingDocKey)
                  }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DOC_FIELDS.map(({ key, label, short }) => {
                    const url = selected[key]
                    const uploading = uploadingDoc === key
                    return (
                      <div key={key} className={`rounded-2xl border p-4 flex items-center gap-4 transition-all ${url ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${url ? 'bg-green-100 text-green-700' : 'bg-white text-gray-400 border border-gray-200'}`}>
                          {short}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{label}</p>
                          {url ? (
                            <p className="text-xs text-green-600 font-medium mt-0.5">Uploaded</p>
                          ) : (
                            <p className="text-xs text-gray-400 mt-0.5">Not uploaded</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-8 h-8 rounded-lg bg-green-100 hover:bg-green-200 flex items-center justify-center text-green-700 transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => { setPendingDocKey(key); docFileRef.current?.click() }}
                            disabled={uploading}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${uploading ? 'bg-gray-100 text-gray-300' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'}`}
                            title="Upload"
                          >
                            {uploading ? (
                              <Clock className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Admission progress */}
                <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Student Status</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[11px] text-gray-400 mb-1">Verification</p>
                      <p className="font-semibold capitalize text-gray-800">{selected.verification_status.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[11px] text-gray-400 mb-1">Exam Status</p>
                      <p className="font-semibold capitalize text-gray-800">{selected.exam_status.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                      <span>Admission Progress</span>
                      <span className="font-semibold text-blue-600">{selected.admission_progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${selected.admission_progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ACCESS TAB ── */}
            {tab === 'access' && (
              <div className="p-5 space-y-4">
                {/* Status card */}
                <div className={`rounded-2xl border p-4 flex items-center gap-4 ${selected.portal_active ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selected.portal_active ? 'bg-green-100' : 'bg-gray-200'}`}>
                    <ShieldCheck className={`w-5 h-5 ${selected.portal_active ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selected.portal_active ? 'Portal Active' : 'Portal Inactive'}</p>
                    {selected.portal_username ? (
                      <p className="text-xs text-gray-500 font-mono mt-0.5">Login: {fmtEnroll(selected.portal_username)}</p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">No credentials set</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">
                    {selected.portal_active ? 'Reset Password' : 'Create Portal Access'}
                  </p>
                  {selected.portal_username && (
                    <div className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Username</span>
                      <span className="text-sm font-mono font-medium text-gray-800">{fmtEnroll(selected.portal_username)}</span>
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Set new password (min 6 chars)"
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50"
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-1.5"
                      onClick={saveCredentials}
                      disabled={savingCred || pass.length < 6}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      {savingCred ? 'Saving…' : selected.portal_active ? 'Reset Password' : 'Create Access'}
                    </Button>
                    <Button variant="outline" onClick={() => setPass('')}>Clear</Button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      ) : (
        /* Empty state — desktop only */
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
            <ChevronRight className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">Select a student</p>
          <p className="text-xs text-gray-400 mt-1">View updates, documents & access from here</p>
        </div>
      )}
    </div>
  )
}

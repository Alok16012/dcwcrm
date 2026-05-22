'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Search, Eye, EyeOff, Copy, RefreshCw, Bell, Send,
  MoreVertical, KeyRound, ShieldCheck, UserPlus, CheckCircle2, FileText,
  ChevronRight, GraduationCap,
} from 'lucide-react'

interface PortalStudent {
  id: string
  full_name: string
  phone: string
  email: string | null
  enrollment_number: string
  status: string
  portal_active: boolean
  portal_username: string | null
  portal_temp_password: string | null
  portal_user_id: string | null
  verification_status: string
  exam_status: string
  result_status: string
  admission_progress: number
  admit_card_url: string | null
  enrollment_card_url: string | null
  id_card_url: string | null
  marksheet_url: string | null
  course?: { name: string }
  department?: { name: string }
}

const VERIFICATION_OPTS = ['pending', 'in_review', 'verified', 'rejected']
const EXAM_OPTS = ['not_scheduled', 'scheduled', 'completed', 'result_awaited', 'passed', 'failed']
const RESULT_OPTS = ['awaited', 'declared', 'passed', 'failed', 're_appear']

const verificationColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  in_review: 'bg-blue-100 text-blue-700 border-blue-200',
  verified: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
}
const examColor: Record<string, string> = {
  not_scheduled: 'bg-gray-100 text-gray-600 border-gray-200',
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  result_awaited: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  passed: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
}

function progressColor(pct: number) {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 50) return 'bg-blue-500'
  if (pct >= 25) return 'bg-yellow-500'
  return 'bg-gray-300'
}

function formatLabel(val: string) {
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function StudentPortalManager() {
  const supabase = createClient()
  const [students, setStudents] = useState<PortalStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPortal, setFilterPortal] = useState<'all' | 'active' | 'inactive'>('all')

  // Credentials dialog
  const [credOpen, setCredOpen] = useState(false)
  const [credStudent, setCredStudent] = useState<PortalStudent | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingCred, setSavingCred] = useState(false)

  // Portal data dialog
  const [dataOpen, setDataOpen] = useState(false)
  const [dataStudent, setDataStudent] = useState<PortalStudent | null>(null)
  const [portalForm, setPortalForm] = useState<Partial<PortalStudent>>({})
  const [savingData, setSavingData] = useState(false)

  // Notification dialog
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifStudent, setNotifStudent] = useState<PortalStudent | null>(null)
  const [notifTitle, setNotifTitle] = useState('')
  const [notifMsg, setNotifMsg] = useState('')
  const [notifType, setNotifType] = useState('info')
  const [sendingNotif, setSendingNotif] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select(`
        id, full_name, phone, email, enrollment_number, status,
        portal_active, portal_username, portal_temp_password, portal_user_id,
        verification_status, exam_status, result_status, admission_progress,
        admit_card_url, enrollment_card_url, id_card_url, marksheet_url,
        course:courses(name), department:departments(name)
      `)
      .neq('status', 'dropped')
      .order('full_name')
    setStudents((data ?? []) as unknown as PortalStudent[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const filtered = students.filter(s => {
    const matchSearch = !search
      || s.full_name.toLowerCase().includes(search.toLowerCase())
      || s.phone.includes(search)
      || s.enrollment_number.toLowerCase().includes(search.toLowerCase())
    const matchPortal = filterPortal === 'all'
      || (filterPortal === 'active' && s.portal_active)
      || (filterPortal === 'inactive' && !s.portal_active)
    return matchSearch && matchPortal
  })

  async function handleCreateOrReset() {
    if (!credStudent || !newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setSavingCred(true)
    try {
      const endpoint = credStudent.portal_active ? '/api/students/reset-password' : '/api/students/create-credentials'
      const body = credStudent.portal_active
        ? { student_id: credStudent.id, new_password: newPassword }
        : { student_id: credStudent.id, password: newPassword }
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(credStudent.portal_active ? 'Password reset ho gaya!' : 'Portal access create ho gaya!')
      setCredOpen(false)
      setNewPassword('')
      load()
    } finally {
      setSavingCred(false)
    }
  }

  async function handleSavePortalData() {
    if (!dataStudent) return
    setSavingData(true)
    try {
      const res = await fetch('/api/students/update-portal-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: dataStudent.id, ...portalForm }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Portal data update ho gaya!')
      setDataOpen(false)
      load()
    } finally {
      setSavingData(false)
    }
  }

  async function handleSendNotif() {
    if (!notifStudent || !notifTitle || !notifMsg) { toast.error('Title aur message required hai'); return }
    setSendingNotif(true)
    try {
      const res = await fetch('/api/students/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: notifStudent.id, title: notifTitle, message: notifMsg, type: notifType }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Notification send ho gaya!')
      setNotifOpen(false)
    } finally {
      setSendingNotif(false)
    }
  }

  function openCredDialog(s: PortalStudent) {
    setCredStudent(s)
    setNewPassword('')
    setShowPass(false)
    setCredOpen(true)
  }

  function openDataDialog(s: PortalStudent) {
    setDataStudent(s)
    setPortalForm({
      verification_status: s.verification_status,
      exam_status: s.exam_status,
      result_status: s.result_status,
      admission_progress: s.admission_progress,
      admit_card_url: s.admit_card_url ?? '',
      enrollment_card_url: s.enrollment_card_url ?? '',
      id_card_url: s.id_card_url ?? '',
      marksheet_url: s.marksheet_url ?? '',
    })
    setDataOpen(true)
  }

  function openNotifDialog(s: PortalStudent) {
    setNotifStudent(s)
    setNotifTitle('')
    setNotifMsg('')
    setNotifType('info')
    setNotifOpen(true)
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copied!')
  }

  const totalActive = students.filter(s => s.portal_active).length

  return (
    <div className="space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Total Students</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{students.length}</p>
        </div>
        <div className="bg-white border border-green-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-medium text-green-600">Portal Active</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{totalActive}</p>
          <p className="text-xs text-gray-400 mt-0.5">students can login</p>
        </div>
        <div className="bg-white border border-orange-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-medium text-orange-500">Portal Pending</p>
          <p className="text-3xl font-bold text-orange-500 mt-1">{students.length - totalActive}</p>
          <p className="text-xs text-gray-400 mt-0.5">no access yet</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Name, phone ya enrollment number se search karo..."
            className="pl-9 h-10 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterPortal} onValueChange={v => setFilterPortal(v as 'all' | 'active' | 'inactive')}>
          <SelectTrigger className="w-44 h-10 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Sabhi Students</SelectItem>
            <SelectItem value="active">Portal Active</SelectItem>
            <SelectItem value="inactive">No Portal</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-10 px-3" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Student Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Koi student nahi mila</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const docs = [
              { label: 'Admit Card', url: s.admit_card_url },
              { label: 'Enrollment Card', url: s.enrollment_card_url },
              { label: 'ID Card', url: s.id_card_url },
              { label: 'Marksheet', url: s.marksheet_url },
            ]
            const docsUploaded = docs.filter(d => d.url).length

            return (
              <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                    {s.full_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{s.full_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.phone} · {s.enrollment_number}</p>
                      </div>

                      {/* Action dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 shrink-0">
                            Actions
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => openCredDialog(s)} className="gap-2 cursor-pointer">
                            {s.portal_active
                              ? <><KeyRound className="h-4 w-4 text-orange-500" /> Reset Password</>
                              : <><UserPlus className="h-4 w-4 text-blue-500" /> Portal Access Create Karo</>
                            }
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDataDialog(s)} className="gap-2 cursor-pointer">
                            <ShieldCheck className="h-4 w-4 text-green-500" />
                            Status &amp; Documents Update Karo
                          </DropdownMenuItem>
                          {s.portal_active && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openNotifDialog(s)} className="gap-2 cursor-pointer">
                                <Bell className="h-4 w-4 text-purple-500" />
                                Notification Bhejo
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Status row */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {/* Portal status */}
                      {s.portal_active ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium border border-green-200">
                          <CheckCircle2 className="h-3 w-3" /> Portal Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                          No Portal
                        </span>
                      )}
                      {/* Verification */}
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${verificationColor[s.verification_status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {formatLabel(s.verification_status || 'pending')}
                      </span>
                      {/* Exam */}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${examColor[s.exam_status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        Exam: {formatLabel(s.exam_status || 'not_scheduled')}
                      </span>
                      {/* Course */}
                      {(s.course as unknown as { name: string })?.name && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                          {(s.course as unknown as { name: string }).name}
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">Admission Progress</span>
                        <span className="text-xs font-semibold text-gray-700">{s.admission_progress ?? 0}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${progressColor(s.admission_progress ?? 0)}`}
                          style={{ width: `${s.admission_progress ?? 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <FileText className="h-3.5 w-3.5" />
                        <span>{docsUploaded}/4 documents</span>
                      </div>
                      {docs.filter(d => d.url).map(d => (
                        <a
                          key={d.label}
                          href={d.url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                          {d.label} <ChevronRight className="h-3 w-3" />
                        </a>
                      ))}
                    </div>

                    {/* Login ID if active */}
                    {s.portal_active && s.portal_username && (
                      <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 w-fit">
                        <span className="text-xs text-gray-500">Login ID:</span>
                        <code className="text-xs font-mono font-semibold text-gray-800">{s.portal_username}</code>
                        <button onClick={() => copyText(s.portal_username!)} className="text-gray-400 hover:text-blue-500">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Credentials Dialog */}
      <Dialog open={credOpen} onOpenChange={setCredOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {credStudent?.portal_active
                ? <><KeyRound className="h-5 w-5 text-orange-500" /> Password Reset Karo</>
                : <><UserPlus className="h-5 w-5 text-blue-500" /> Portal Access Create Karo</>
              }
            </DialogTitle>
          </DialogHeader>
          {credStudent && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="font-semibold text-gray-900">{credStudent.full_name}</p>
                <p className="text-sm text-gray-500">Enrollment No: {credStudent.enrollment_number}</p>
                {!credStudent.portal_active && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                    Student ka <strong>Login ID</strong> hoga: <strong>{credStudent.enrollment_number}</strong>
                  </div>
                )}
                {credStudent.portal_active && credStudent.portal_username && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">Current Login ID:</span>
                    <code className="text-xs font-mono bg-white border rounded px-2 py-0.5">{credStudent.portal_username}</code>
                    <button onClick={() => copyText(credStudent.portal_username!)} className="text-blue-500">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {credStudent.portal_active ? 'Naya Password' : 'Password Set Karo'}
                </Label>
                <div className="relative">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPass(v => !v)}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateOrReset} disabled={savingCred || !newPassword || newPassword.length < 6}>
              {savingCred ? 'Saving...' : credStudent?.portal_active ? 'Password Reset Karo' : 'Portal Access De Do'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Portal Data Dialog */}
      <Dialog open={dataOpen} onOpenChange={setDataOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Status &amp; Documents — {dataStudent?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Status section */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Admission Status</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Verification Status</Label>
                  <Select value={portalForm.verification_status ?? ''} onValueChange={v => setPortalForm(f => ({ ...f, verification_status: v ?? undefined }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {VERIFICATION_OPTS.map(o => <SelectItem key={o} value={o}>{formatLabel(o)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Exam Status</Label>
                  <Select value={portalForm.exam_status ?? ''} onValueChange={v => setPortalForm(f => ({ ...f, exam_status: v ?? undefined }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {EXAM_OPTS.map(o => <SelectItem key={o} value={o}>{formatLabel(o)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Result Status</Label>
                  <Select value={portalForm.result_status ?? ''} onValueChange={v => setPortalForm(f => ({ ...f, result_status: v ?? undefined }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {RESULT_OPTS.map(o => <SelectItem key={o} value={o}>{formatLabel(o)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Admission Progress (%)</Label>
                  <div className="space-y-2">
                    <Input
                      type="number" min={0} max={100}
                      className="h-9"
                      value={portalForm.admission_progress ?? 0}
                      onChange={e => setPortalForm(f => ({ ...f, admission_progress: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                    />
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${progressColor(portalForm.admission_progress ?? 0)}`}
                        style={{ width: `${portalForm.admission_progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Documents section */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Document Links</p>
              <p className="text-xs text-gray-500">Google Drive / S3 ya koi bhi public URL paste karo — student portal pe directly download hoga</p>
              {[
                { key: 'admit_card_url', label: 'Admit Card URL' },
                { key: 'enrollment_card_url', label: 'Enrollment Card URL' },
                { key: 'id_card_url', label: 'ID Card URL' },
                { key: 'marksheet_url', label: 'Marksheet URL' },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">{label}</Label>
                  <div className="flex gap-2">
                    <Input
                      className="h-9 text-sm flex-1"
                      placeholder="https://drive.google.com/... ya koi bhi URL"
                      value={(portalForm as Record<string, string | null | number | undefined>)[key] as string ?? ''}
                      onChange={e => setPortalForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                    {(portalForm as Record<string, string | null | number | undefined>)[key] && (
                      <a
                        href={(portalForm as Record<string, string | null | number | undefined>)[key] as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 px-3 flex items-center text-xs text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50"
                      >
                        Preview
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDataOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePortalData} disabled={savingData}>
              {savingData ? 'Saving...' : 'Save Karo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification Dialog */}
      <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-500" />
              Notification Bhejo — {notifStudent?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { val: 'info', label: 'Info', color: 'blue' },
                  { val: 'success', label: 'Success', color: 'green' },
                  { val: 'warning', label: 'Warning', color: 'yellow' },
                  { val: 'alert', label: 'Alert', color: 'red' },
                ].map(t => (
                  <button
                    key={t.val}
                    onClick={() => setNotifType(t.val)}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                      notifType === t.val
                        ? t.color === 'blue' ? 'bg-blue-500 text-white border-blue-500'
                          : t.color === 'green' ? 'bg-green-500 text-white border-green-500'
                          : t.color === 'yellow' ? 'bg-yellow-500 text-white border-yellow-500'
                          : 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Title</Label>
              <Input
                className="h-9"
                placeholder="Notification ka title likho..."
                value={notifTitle}
                onChange={e => setNotifTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Message</Label>
              <Textarea
                rows={4}
                placeholder="Student ko kya batana hai woh yahan likho..."
                value={notifMsg}
                onChange={e => setNotifMsg(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSendNotif}
              disabled={sendingNotif || !notifTitle || !notifMsg}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {sendingNotif ? 'Sending...' : 'Send Karo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

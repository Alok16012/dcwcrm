'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import { FileText, Download, Upload, Trash2, Plus, FolderOpen, X, Eye, EyeOff } from 'lucide-react'

// Fee sheet library, three simple steps:
//   Department (Open School / Distance / …) → Board or University (NIOS / IGNOU …) → Level (optional) → PDF
// Stored in fee_documents as category → sub_category → level.

interface FeeDoc {
  id: string
  category: string
  sub_category: string
  level: string | null
  title: string | null
  file_url: string
  file_name: string | null
  file_size: string | null
  is_active: boolean
  created_at: string
}

const EMPTY_FORM = { category: '', sub_category: '', level: '', title: '' }

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const uniq = (arr: (string | null | undefined)[]) =>
  [...new Set(arr.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b))

// Open School departments pick a board; everything else picks a university/college
const subLabel = (dept: string) => /open/i.test(dept) ? 'Board' : dept ? 'University / College' : 'Board / University'

// Predefined boards/universities per department keyword
const DEPT_BOARDS: Record<string, string[]> = {
  'Open School': ['NIOS', 'BOSSE', 'BOSE', 'HBSE Open', 'MPBSE Open', 'RBSE Open', 'UP Open'],
  'Distance': ['IGNOU', 'Jamia Millia Islamia', 'Annamalai University', 'Madhya Pradesh Bhoj Open University', 'Netaji Subhas Open University'],
  'Regular': ['CBSE', 'ICSE', 'RBSE', 'HBSE', 'MPBSE', 'UP Board', 'Bihar Board'],
}

// Predefined levels per board keyword
const BOARD_LEVELS: Record<string, string[]> = {
  'NIOS':  ['10th', '12th'],
  'BOSSE': ['10th', '12th'],
  'BOSE':  ['10th', '12th'],
  'CBSE':  ['10th', '12th'],
  'ICSE':  ['10th', '12th'],
  'RBSE':  ['10th', '12th'],
  'HBSE':  ['10th', '12th'],
  'MPBSE': ['10th', '12th'],
  'UP Board': ['10th', '12th'],
  'Bihar Board': ['10th', '12th'],
  'IGNOU': ['BA', 'BCom', 'BSc', 'MA', 'MCom', 'MSc', 'BCA', 'MCA', 'BED', 'MBA'],
}

function getBoardOptions(dept: string, existingSubs: string[]): string[] {
  const key = Object.keys(DEPT_BOARDS).find(k => dept.toLowerCase().includes(k.toLowerCase())) ?? ''
  const predefined = key ? DEPT_BOARDS[key] : []
  return uniq([...predefined, ...existingSubs])
}

function getLevelOptions(board: string, existingLevels: string[]): string[] {
  const key = Object.keys(BOARD_LEVELS).find(k => board.toLowerCase().includes(k.toLowerCase())) ?? ''
  const predefined = key ? BOARD_LEVELS[key] : []
  return uniq([...predefined, ...existingLevels])
}

const selectCls = 'w-full border border-gray-200 rounded-lg px-3 h-10 text-sm bg-white text-gray-800 disabled:bg-gray-50 disabled:text-gray-400'

export function FeeDocumentsClient() {
  const supabase = createClient()
  const db = supabase as any

  const [role, setRole] = useState<string>('')
  const [docs, setDocs] = useState<FeeDoc[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [selDept, setSelDept] = useState('')
  const [selSub, setSelSub] = useState('')
  const [selLevel, setSelLevel] = useState('')

  const [uploadOpen, setUploadOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const isAdmin = role === 'admin' || role === 'backend'

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRole((prof as any)?.role ?? '')
    }
    const [{ data }, { data: depts }] = await Promise.all([
      db.from('fee_documents')
        .select('id, category, sub_category, level, title, file_url, file_name, file_size, is_active, created_at')
        .order('created_at', { ascending: false }),
      db.from('departments').select('name').eq('is_active', true).order('name'),
    ])
    setDocs((data ?? []) as FeeDoc[])
    setDepartments(((depts ?? []) as { name: string }[]).map(d => d.name))
    setLoading(false)
  }, [db, supabase])

  useEffect(() => { load() }, [load])

  // Browse options only list what actually has a fee sheet
  const deptOptions = uniq(docs.map(d => d.category))
  const subOptions = uniq(docs.filter(d => d.category === selDept).map(d => d.sub_category))
  const levelOptions = uniq(docs.filter(d => d.category === selDept && d.sub_category === selSub).map(d => d.level))

  const ready = !!selDept && !!selSub && (levelOptions.length === 0 || !!selLevel)
  const results = ready
    ? docs.filter(d =>
        d.category === selDept && d.sub_category === selSub &&
        (levelOptions.length === 0 || d.level === selLevel))
    : []

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category || !form.sub_category.trim()) { toast.error(`Select department and enter ${subLabel(form.category).toLowerCase()}`); return }
    if (!file) { toast.error('Choose the fee PDF'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const ext = file.name.split('.').pop()
      const path = `fee-documents/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('student-documents').upload(path, file, { upsert: true })
      if (upErr) throw new Error(upErr.message)
      const fileUrl = supabase.storage.from('student-documents').getPublicUrl(path).data.publicUrl
      const { error } = await db.from('fee_documents').insert({
        category: form.category,
        sub_category: form.sub_category.trim(),
        level: form.level.trim() || null,
        title: form.title.trim() || null,
        file_url: fileUrl,
        file_name: file.name,
        file_size: humanSize(file.size),
        uploaded_by: user?.id ?? null,
      })
      if (error) throw new Error(error.message)
      toast.success('Fee PDF uploaded')
      setForm(EMPTY_FORM); setFile(null); setUploadOpen(false)
      load()
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(d: FeeDoc) {
    setBusyId(d.id)
    const { error } = await db.from('fee_documents').update({ is_active: !d.is_active }).eq('id', d.id)
    if (error) toast.error(error.message)
    else setDocs(prev => prev.map(x => x.id === d.id ? { ...x, is_active: !x.is_active } : x))
    setBusyId(null)
  }

  async function remove(d: FeeDoc) {
    if (!window.confirm(`Delete this fee PDF?\n\n${pathOf(d)}`)) return
    setBusyId(d.id)
    const { error } = await db.from('fee_documents').delete().eq('id', d.id)
    if (error) toast.error(error.message)
    else { setDocs(prev => prev.filter(x => x.id !== d.id)); toast.success('Deleted') }
    setBusyId(null)
  }

  function openUpload() {
    // Pre-fill with whatever is selected in the browser above
    setForm({ category: selDept, sub_category: selSub, level: selLevel, title: '' })
    setFile(null)
    setUploadOpen(true)
  }

  const uploadDepts = uniq([...departments, ...deptOptions])
  const uploadSubs = uniq(docs.filter(d => d.category === form.category).map(d => d.sub_category))
  const uploadLevels = uniq(docs.filter(d => d.category === form.category && d.sub_category === form.sub_category.trim()).map(d => d.level))

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader title="Fees" description="Select department, then board / university to download the fee PDF" />
        {isAdmin && (
          <Button onClick={openUpload} className="gap-1.5">
            <Upload className="w-4 h-4" /> Upload Fee PDF
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl bg-white">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500">No fee PDFs yet</p>
          <p className="text-xs text-gray-400 mt-1">{isAdmin ? 'Click "Upload Fee PDF" to add the first one' : 'Fee PDFs will be added by the admin team'}</p>
        </div>
      ) : (
        <>
          <div className="bg-white border rounded-2xl p-4 space-y-3">
            <Step n={1} label="Department">
              <select className={selectCls} value={selDept}
                onChange={e => { setSelDept(e.target.value); setSelSub(''); setSelLevel('') }}>
                <option value="">Select department…</option>
                {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Step>

            <Step n={2} label={subLabel(selDept)}>
              <select className={selectCls} value={selSub} disabled={!selDept}
                onChange={e => { setSelSub(e.target.value); setSelLevel('') }}>
                <option value="">{selDept ? `Select ${subLabel(selDept).toLowerCase()}…` : 'Select department first'}</option>
                {subOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Step>

            {selSub && levelOptions.length > 0 && (
              <Step n={3} label="Level">
                <select className={selectCls} value={selLevel} onChange={e => setSelLevel(e.target.value)}>
                  <option value="">Select level…</option>
                  {levelOptions.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Step>
            )}
          </div>

          {ready && (
            <div className="space-y-2">
              {results.length === 0 ? (
                <div className="text-center py-10 border rounded-2xl bg-white text-sm text-gray-400">No fee PDF for this selection</div>
              ) : results.map(d => (
                <DocRow key={d.id} d={d} isAdmin={isAdmin} busy={busyId === d.id}
                  onToggle={() => toggleActive(d)} onDelete={() => remove(d)} />
              ))}
            </div>
          )}

          {/* Admin: everything uploaded, for hiding / deleting */}
          {isAdmin && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">All uploaded fee PDFs ({docs.length})</p>
              {docs.map(d => (
                <DocRow key={d.id} d={d} isAdmin busy={busyId === d.id}
                  onToggle={() => toggleActive(d)} onDelete={() => remove(d)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Upload — same steps as download */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" /> Upload Fee PDF
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-3 mt-1">
            {/* Step 1 – Department */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">1. Department *</Label>
              <select className={selectCls} value={form.category} required
                onChange={e => setForm(f => ({ ...f, category: e.target.value, sub_category: '', level: '' }))}>
                <option value="">Select department…</option>
                {uploadDepts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Step 2 – Board / University (cascades from department) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">2. {subLabel(form.category)} *</Label>
              <select
                className={selectCls}
                value={form.sub_category}
                disabled={!form.category}
                required
                onChange={e => setForm(f => ({ ...f, sub_category: e.target.value, level: '' }))}
              >
                <option value="">
                  {form.category ? `Select ${subLabel(form.category).toLowerCase()}…` : 'Select department first'}
                </option>
                {getBoardOptions(form.category, uploadSubs).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Step 3 – Level (cascades from board; only shown if there are options) */}
            {(() => {
              const lvlOpts = getLevelOptions(form.sub_category, uploadLevels)
              return (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600">
                    3. Level <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <select
                    className={selectCls}
                    value={form.level}
                    disabled={!form.sub_category}
                    onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                  >
                    <option value="">
                      {form.sub_category ? 'Select level… (or leave blank)' : 'Select board first'}
                    </option>
                    {lvlOpts.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              )
            })()}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Fee PDF *</Label>
              {file ? (
                <div className="flex items-center gap-2 border border-green-300 bg-green-50 rounded-lg px-3 py-2 text-sm">
                  <FileText className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-green-800 text-xs truncate flex-1">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-green-500 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-lg py-5 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 cursor-pointer transition-colors">
                  <Plus className="w-5 h-5" />
                  <span className="text-xs font-medium">Choose PDF</span>
                  <input type="file" accept="application/pdf,image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Title <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input placeholder="Defaults to file name" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving} className="min-w-28">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Upload'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const pathOf = (d: FeeDoc) => [d.category, d.sub_category, d.level].filter(Boolean).join(' › ')

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-gray-600">{n}. {label}</Label>
      {children}
    </div>
  )
}

function DocRow({ d, isAdmin, busy, onToggle, onDelete }: {
  d: FeeDoc; isAdmin: boolean; busy: boolean; onToggle: () => void; onDelete: () => void
}) {
  return (
    <div className={`bg-white border rounded-xl p-3 flex items-center gap-3 ${d.is_active ? 'border-gray-100' : 'border-amber-200 bg-amber-50/40'}`}>
      <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{d.title || d.file_name || 'Fee PDF'}</p>
        <p className="text-[11px] text-gray-500 truncate">
          {pathOf(d)}
          {d.file_size && <span className="text-gray-400"> · {d.file_size}</span>}
          {!d.is_active && <span className="text-amber-600 font-bold"> · HIDDEN</span>}
        </p>
      </div>
      <a href={d.file_url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 shrink-0">
        <Download className="w-3.5 h-3.5" /> Download
      </a>
      {isAdmin && (
        <div className="flex items-center shrink-0">
          <button onClick={onToggle} disabled={busy} title={d.is_active ? 'Hide from associates' : 'Show to associates'}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            {d.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onDelete} disabled={busy} title="Delete"
            className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

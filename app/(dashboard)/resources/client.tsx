'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import {
  Upload, FileText, Download, Eye, EyeOff, Trash2, Plus, X, Search, Folder, Loader2,
} from 'lucide-react'

// Prospectus / pamphlets / posters that associates download, uploaded here by
// admin & backend and tagged department-wise.

const TYPES: { value: string; label: string }[] = [
  { value: 'prospectus', label: 'College Prospectus' },
  { value: 'pamphlet', label: 'Pamphlet' },
  { value: 'poster', label: 'Poster' },
  { value: 'brochure', label: 'Brochure' },
  { value: 'fee_structure', label: 'Fee Structure' },
  { value: 'admission_form', label: 'Admission Form' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
]
const TYPE_LABEL = Object.fromEntries(TYPES.map(t => [t.value, t.label]))

interface Resource {
  id: string
  title: string
  description: string | null
  type: string
  url: string
  file_size: string | null
  department: string | null
  is_active: boolean
  created_at: string
}

const EMPTY_FORM = { title: '', description: '', type: 'prospectus', department: '' }
const BUCKET = 'student-documents'
const selectCls = 'w-full border border-gray-200 rounded-lg px-3 h-10 text-sm bg-white text-gray-800'

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ResourcesClient() {
  const supabase = createClient()
  const db = supabase as any

  const [role, setRole] = useState('')
  const [rows, setRows] = useState<Resource[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDept, setFilterDept] = useState('')

  const [uploadOpen, setUploadOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const canManage = role === 'admin' || role === 'backend'

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRole((prof as any)?.role ?? '')
    }
    const [{ data }, { data: depts }] = await Promise.all([
      db.from('associate_resources')
        .select('id, title, description, type, url, file_size, department, is_active, created_at')
        .order('created_at', { ascending: false }),
      db.from('departments').select('name').eq('is_active', true).order('name'),
    ])
    setRows((data ?? []) as Resource[])
    setDepartments(((depts ?? []) as { name: string }[]).map(d => d.name))
    setLoading(false)
  }, [db, supabase])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    return (!q || r.title.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)) &&
      (!filterType || r.type === filterType) &&
      (!filterDept || (r.department ?? '') === filterDept)
  })

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!file) { toast.error('Choose a file to upload'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const ext = file.name.split('.').pop()
      const path = `associate-resources/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
      if (upErr) throw new Error(upErr.message)
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      const { error } = await db.from('associate_resources').insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        department: form.department || null,
        url,
        file_size: humanSize(file.size),
        uploaded_by: user?.id ?? null,
      })
      if (error) throw new Error(error.message)
      toast.success('Resource uploaded')
      setForm(EMPTY_FORM); setFile(null); setUploadOpen(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(r: Resource) {
    setBusyId(r.id)
    const { error } = await db.from('associate_resources').update({ is_active: !r.is_active }).eq('id', r.id)
    if (error) toast.error(error.message)
    else setRows(prev => prev.map(x => x.id === r.id ? { ...x, is_active: !x.is_active } : x))
    setBusyId(null)
  }

  async function remove(r: Resource) {
    if (!window.confirm(`Delete this resource?\n\n${r.title}`)) return
    setBusyId(r.id)
    const { error } = await db.from('associate_resources').delete().eq('id', r.id)
    if (error) toast.error(error.message)
    else { setRows(prev => prev.filter(x => x.id !== r.id)); toast.success('Deleted') }
    setBusyId(null)
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader title="Resources" description="Prospectus, pamphlets and posters associates can download" />
        {canManage && (
          <Button onClick={() => { setForm(EMPTY_FORM); setFile(null); setUploadOpen(true) }} className="gap-1.5">
            <Upload className="w-4 h-4" /> Upload Resource
          </Button>
        )}
      </div>

      <div className="bg-white border rounded-xl p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search resources…"
            className="w-full pl-8 pr-3 h-8 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded-lg px-2 h-8 text-xs bg-white min-w-36">
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="border rounded-lg px-2 h-8 text-xs bg-white min-w-36">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {(search || filterType || filterDept) && (
          <button onClick={() => { setSearch(''); setFilterType(''); setFilterDept('') }} className="text-xs text-blue-600 hover:underline px-1">Clear</button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl bg-white">
          <Folder className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500">No resources yet</p>
          <p className="text-xs text-gray-400 mt-1">{canManage ? 'Click "Upload Resource" to add the first one' : 'Materials will be added by the admin team'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Showing {filtered.length} of {rows.length}</p>
          {filtered.map((r, idx) => (
            <ResourceRow key={r.id} idx={idx + 1} r={r} canManage={canManage} busy={busyId === r.id}
              onToggle={() => toggleActive(r)} onDelete={() => remove(r)} />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 border rounded-2xl bg-white text-sm text-gray-400">No resources match these filters</div>
          )}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" /> Upload Resource
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">1. Type *</Label>
              <select className={selectCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">2. Department</Label>
              <select className={selectCls} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                <option value="">All departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">3. Title *</Label>
              <Input placeholder="e.g. NIOS Prospectus 2026" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Textarea rows={2} className="resize-y" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">File * <span className="text-gray-400 font-normal">(PDF / image)</span></Label>
              {file ? (
                <div className="flex items-center gap-2 border border-green-300 bg-green-50 rounded-lg px-3 py-2 text-sm">
                  <FileText className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-green-800 text-xs truncate flex-1">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-green-500 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-lg py-5 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 cursor-pointer transition-colors">
                  <Plus className="w-5 h-5" />
                  <span className="text-xs font-medium">Choose file</span>
                  <input type="file" accept="application/pdf,image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
                </label>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving} className="min-w-28">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ResourceRow({ idx, r, canManage, busy, onToggle, onDelete }: {
  idx: number; r: Resource; canManage: boolean; busy: boolean; onToggle: () => void; onDelete: () => void
}) {
  const [downloading, setDownloading] = useState(false)

  async function download() {
    setDownloading(true)
    try {
      const res = await fetch(r.url)
      const blob = await res.blob()
      const ext = (r.url.split('?')[0].split('.').pop() ?? 'pdf').slice(0, 5)
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = `${r.title.replace(/[^\w-]+/g, '_')}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(href), 1000)
    } catch {
      window.open(r.url, '_blank', 'noopener')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={`bg-white border rounded-xl p-3 flex items-center gap-3 ${r.is_active ? 'border-gray-100' : 'border-amber-200 bg-amber-50/40'}`}>
      <span className="w-6 text-xs font-semibold text-gray-400 tabular-nums shrink-0">{idx}</span>
      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{r.title}</p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">
            {TYPE_LABEL[r.type] ?? r.type}
          </span>
          <span className="text-[11px] text-gray-500">{r.department || 'All departments'}</span>
          {r.file_size && <span className="text-[10px] text-gray-400">· {r.file_size}</span>}
          {!r.is_active && <span className="text-[10px] font-bold text-amber-600 uppercase">Hidden</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <a href={r.url} target="_blank" rel="noopener noreferrer" title="Preview"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-gray-600 bg-gray-100 hover:bg-gray-200">
          <Eye className="w-3.5 h-3.5" /> Preview
        </a>
        <button type="button" onClick={download} disabled={downloading} title="Download"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download
        </button>
        {canManage && (
          <>
            <button onClick={onToggle} disabled={busy} title={r.is_active ? 'Hide from associates' : 'Show to associates'}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              {r.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onDelete} disabled={busy} title="Delete"
              className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

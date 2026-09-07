'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import {
  FileText, Download, Upload, Trash2, Plus, Search, FolderOpen,
  ChevronRight, Layers, X, Eye, EyeOff,
} from 'lucide-react'

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

export function FeeDocumentsClient() {
  const supabase = createClient()
  const db = supabase as any

  const [role, setRole] = useState<string>('')
  const [docs, setDocs] = useState<FeeDoc[]>([])
  const [loading, setLoading] = useState(true)

  // Cascade selection
  const [selCat, setSelCat] = useState('')
  const [selSub, setSelSub] = useState('')
  const [selLevel, setSelLevel] = useState('')
  const [search, setSearch] = useState('')

  // Admin upload
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
    const { data } = await db.from('fee_documents')
      .select('id, category, sub_category, level, title, file_url, file_name, file_size, is_active, created_at')
      .order('category').order('sub_category').order('level', { nullsFirst: true }).order('created_at', { ascending: false })
    setDocs((data ?? []) as FeeDoc[])
    setLoading(false)
  }, [db, supabase])

  useEffect(() => { load() }, [load])

  // Non-admins only ever receive active rows (RLS); admins see inactive too.
  const categories = uniq(docs.map(d => d.category))
  const subs = uniq(docs.filter(d => d.category === selCat).map(d => d.sub_category))
  const levels = uniq(docs.filter(d => d.category === selCat && d.sub_category === selSub).map(d => d.level))

  const matches = docs.filter(d => {
    if (selCat && d.category !== selCat) return false
    if (selSub && d.sub_category !== selSub) return false
    if (selLevel && (d.level ?? '') !== selLevel) return false
    if (search) {
      const q = search.toLowerCase()
      const hay = `${d.category} ${d.sub_category} ${d.level ?? ''} ${d.title ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  function pickCat(c: string) { setSelCat(c === selCat ? '' : c); setSelSub(''); setSelLevel('') }
  function pickSub(s: string) { setSelSub(s === selSub ? '' : s); setSelLevel('') }
  function clearAll() { setSelCat(''); setSelSub(''); setSelLevel(''); setSearch('') }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category.trim() || !form.sub_category.trim()) { toast.error('Category and sub-category required'); return }
    if (!file) { toast.error('Choose a PDF/file to upload'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const ext = file.name.split('.').pop()
      const path = `fee-documents/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('student-documents').upload(path, file, { upsert: true })
      if (upErr) throw new Error(upErr.message)
      const fileUrl = supabase.storage.from('student-documents').getPublicUrl(path).data.publicUrl
      const { error } = await db.from('fee_documents').insert({
        category: form.category.trim(),
        sub_category: form.sub_category.trim(),
        level: form.level.trim() || null,
        title: form.title.trim() || null,
        file_url: fileUrl,
        file_name: file.name,
        file_size: humanSize(file.size),
        uploaded_by: user?.id ?? null,
      })
      if (error) throw new Error(error.message)
      toast.success('Fee sheet uploaded')
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
    if (!window.confirm(`Delete this fee sheet?\n\n${d.category} › ${d.sub_category}${d.level ? ` › ${d.level}` : ''}`)) return
    setBusyId(d.id)
    const { error } = await db.from('fee_documents').delete().eq('id', d.id)
    if (error) toast.error(error.message)
    else { setDocs(prev => prev.filter(x => x.id !== d.id)); toast.success('Deleted') }
    setBusyId(null)
  }

  const catList = uniq(docs.map(d => d.category))
  const subList = uniq(docs.map(d => d.sub_category))
  const levelList = uniq(docs.map(d => d.level))

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader title="Fee Documents" description="Select a category to find and download the fee sheet" />
        {isAdmin && (
          <Button onClick={() => setUploadOpen(true)} className="gap-1.5">
            <Upload className="w-4 h-4" /> Upload Fee Sheet
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search fee sheets…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl bg-white">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500">No fee sheets yet</p>
          <p className="text-xs text-gray-400 mt-1">{isAdmin ? 'Upload the first fee sheet to get started' : 'Fee sheets will be added by the admin team'}</p>
        </div>
      ) : (
        <>
          {/* Cascade: Category → Sub-category → Level */}
          <div className="space-y-3">
            <Tier label="Category" icon={Layers}>
              {categories.map(c => (
                <Chip key={c} active={selCat === c} onClick={() => pickCat(c)}>{c}</Chip>
              ))}
            </Tier>

            {selCat && (
              <Tier label="Sub-category" icon={ChevronRight}>
                {subs.length === 0
                  ? <span className="text-xs text-gray-400">No sub-categories</span>
                  : subs.map(s => <Chip key={s} active={selSub === s} onClick={() => pickSub(s)}>{s}</Chip>)}
              </Tier>
            )}

            {selCat && selSub && levels.length > 0 && (
              <Tier label="Level" icon={ChevronRight}>
                <Chip active={!selLevel} onClick={() => setSelLevel('')}>All</Chip>
                {levels.map(l => <Chip key={l} active={selLevel === l} onClick={() => setSelLevel(l)}>{l}</Chip>)}
              </Tier>
            )}

            {(selCat || selSub || selLevel || search) && (
              <button onClick={clearAll} className="text-xs text-blue-600 hover:underline">Clear selection</button>
            )}
          </div>

          {/* Matching documents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {matches.length === 0 ? (
              <div className="md:col-span-2 text-center py-12 border rounded-2xl bg-white text-sm text-gray-400">
                No fee sheets match your selection
              </div>
            ) : matches.map(d => (
              <div key={d.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 ${d.is_active ? 'border-gray-100' : 'border-amber-200 bg-amber-50/40'}`}>
                <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
                    {d.title || d.file_name || 'Fee Sheet'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                    {d.category} <span className="text-gray-300">›</span> {d.sub_category}
                    {d.level && <> <span className="text-gray-300">›</span> {d.level}</>}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {d.file_size && <span className="text-[10px] text-gray-400 font-medium">{d.file_size}</span>}
                    {!d.is_active && <span className="text-[10px] font-bold text-amber-600 uppercase">Inactive</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                    <Download className="w-3 h-3" /> Download
                  </a>
                  {isAdmin && (
                    <>
                      <button onClick={() => toggleActive(d)} disabled={busyId === d.id}
                        title={d.is_active ? 'Hide (deactivate)' : 'Show (activate)'}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                        {d.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => remove(d)} disabled={busyId === d.id}
                        title="Delete" className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Upload dialog (admin/backend) */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" /> Upload Fee Sheet
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-3 mt-1">
            <datalist id="fd-cats">{catList.map(c => <option key={c} value={c} />)}</datalist>
            <datalist id="fd-subs">{subList.map(s => <option key={s} value={s} />)}</datalist>
            <datalist id="fd-levels">{levelList.map(l => <option key={l} value={l} />)}</datalist>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Category *</Label>
              <Input list="fd-cats" placeholder="e.g. Open Schooling / Distance" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Sub-category *</Label>
              <Input list="fd-subs" placeholder="e.g. NIOS / IGNOU University" value={form.sub_category}
                onChange={e => setForm(f => ({ ...f, sub_category: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Level <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input list="fd-levels" placeholder="e.g. 10th / 12th / UG — leave blank if none" value={form.level}
                onChange={e => setForm(f => ({ ...f, level: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Title <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input placeholder="Display name (defaults to file name)" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
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
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Upload'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Tier({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 mt-1.5 w-28 shrink-0">
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <div className="flex flex-wrap gap-1.5 flex-1">{children}</div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
      }`}>
      {children}
    </button>
  )
}

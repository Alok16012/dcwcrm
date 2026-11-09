'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Upload, PartyPopper, ImageIcon, CalendarDays, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'

/* eslint-disable @typescript-eslint/no-explicit-any */

// Festival greetings (migration 124): an image shown on the staff dashboard,
// the student portal and/or the associate portal between two dates, with
// components/shared/GreetingBanner doing the animation.

type Audience = 'staff' | 'student' | 'associate'
type Effect = 'petals' | 'sparkles' | 'none'

interface Greeting {
  id: string
  title: string
  message: string | null
  image_url: string
  audiences: Audience[]
  starts_on: string
  ends_on: string
  effect: Effect
  is_active: boolean
}
type Draft = Omit<Greeting, 'id'> & { id?: string }

const AUDIENCES: { key: Audience; label: string }[] = [
  { key: 'staff', label: 'Staff' },
  { key: 'student', label: 'Students' },
  { key: 'associate', label: 'Associates' },
]
const EFFECTS: { key: Effect; label: string }[] = [
  { key: 'petals', label: 'Falling petals' },
  { key: 'sparkles', label: 'Sparkles' },
  { key: 'none', label: 'No effect' },
]

const BUCKET = 'student-documents'
const db = () => createClient() as any
const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function statusOf(g: Greeting): { label: string; cls: string } {
  const t = todayIST()
  if (!g.is_active) return { label: 'Off', cls: 'bg-gray-100 text-gray-600' }
  if (t < g.starts_on) return { label: 'Scheduled', cls: 'bg-blue-50 text-blue-700' }
  if (t > g.ends_on) return { label: 'Ended', cls: 'bg-gray-100 text-gray-500' }
  return { label: 'Live now', cls: 'bg-emerald-50 text-emerald-700' }
}

export function GreetingsClient() {
  const [items, setItems] = useState<Greeting[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Greeting | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data, error } = await db().from('greeting_banners').select('*').order('starts_on', { ascending: false })
    if (error) toast.error(error.code === '42P01' ? 'Run migration 124_greeting_banners.sql in Supabase first' : error.message)
    setItems((data ?? []) as Greeting[])
    setLoading(false)
  }, [])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const newDraft = (): Draft => {
    const t = todayIST()
    return { title: '', message: '', image_url: '', audiences: ['staff', 'student', 'associate'], starts_on: t, ends_on: addDays(t, 3), effect: 'petals', is_active: true }
  }

  async function upload(file: File) {
    if (!draft) return
    if (!file.type.startsWith('image/')) return toast.error('Choose an image file (PNG or JPG)')
    if (file.size > 8 * 1024 * 1024) return toast.error('Image is too large — keep it under 8 MB')
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `greetings/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await db().storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw error
      const { data } = db().storage.from(BUCKET).getPublicUrl(path)
      setDraft(d => d ? { ...d, image_url: data.publicUrl } : d)
    } catch (e: any) {
      toast.error(e?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    if (!draft) return
    if (!draft.title.trim()) return toast.error('Enter a title, e.g. Chhath Puja')
    if (!draft.image_url) return toast.error('Upload the greeting image')
    if (draft.audiences.length === 0) return toast.error('Choose who should see it')
    if (draft.ends_on < draft.starts_on) return toast.error('The end date is before the start date')
    setSaving(true)
    const { data: { user } } = await db().auth.getUser()
    const payload = {
      title: draft.title.trim(), message: draft.message?.trim() || null, image_url: draft.image_url,
      audiences: draft.audiences, starts_on: draft.starts_on, ends_on: draft.ends_on,
      effect: draft.effect, is_active: draft.is_active,
    }
    const { error } = draft.id
      ? await db().from('greeting_banners').update(payload).eq('id', draft.id)
      : await db().from('greeting_banners').insert({ ...payload, created_by: user?.id ?? null })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Saved — it shows on the dashboards for those dates')
    setDraft(null)
    load()
  }

  async function toggle(g: Greeting) {
    const { error } = await db().from('greeting_banners').update({ is_active: !g.is_active }).eq('id', g.id)
    if (error) toast.error(error.message)
    else load()
  }

  async function remove(g: Greeting) {
    const { error } = await db().from('greeting_banners').delete().eq('id', g.id)
    setDeleteTarget(null)
    if (error) return toast.error(error.message)
    toast.success('Deleted')
    load()
  }

  return (
    <div>
      <PageHeader
        title="Greetings"
        description="Festival banners on the staff dashboard, student portal and associate portal."
        action={<Button onClick={() => setDraft(newDraft())}><Plus className="w-4 h-4 mr-1" /> New Greeting</Button>}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
            <PartyPopper className="w-7 h-7 text-amber-500" />
          </div>
          <p className="font-semibold text-gray-900">No greetings yet</p>
          <p className="text-sm text-gray-500 mt-1 mb-5">Upload a festival image (e.g. from Canva) and pick the dates.</p>
          <Button onClick={() => setDraft(newDraft())}><Plus className="w-4 h-4 mr-1" /> Add the first greeting</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map(g => {
            const st = statusOf(g)
            return (
              <div key={g.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.image_url} alt={g.title} className="w-full aspect-[16/8] object-cover bg-gray-50" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{g.title}</p>
                      <span className={`mt-1 inline-block text-[10px] font-semibold rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                    </div>
                    <Switch checked={g.is_active} onCheckedChange={() => toggle(g)} />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                    <CalendarDays className="w-3.5 h-3.5" /> {fmtDate(g.starts_on)} – {fmtDate(g.ends_on)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                    <Users className="w-3.5 h-3.5" /> {AUDIENCES.filter(a => g.audiences.includes(a.key)).map(a => a.label).join(', ')}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDraft({ ...g, message: g.message ?? '' })}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setDeleteTarget(g)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={o => { if (!o) setDraft(null) }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          {draft && (
            <div>
              <DialogHeader><DialogTitle>{draft.id ? 'Edit greeting' : 'New greeting'}</DialogTitle></DialogHeader>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Image *</Label>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
                  {draft.image_url ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.image_url} alt="" className="w-full max-h-64 object-cover" />
                      <Button size="sm" variant="outline" className="absolute right-2 bottom-2 bg-white/90" disabled={uploading} onClick={() => fileRef.current?.click()}>
                        {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />} Replace
                      </Button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="w-full rounded-xl border-2 border-dashed border-gray-300 py-10 text-center hover:border-blue-400 hover:bg-blue-50/40 transition">
                      {uploading ? <Loader2 className="w-6 h-6 mx-auto animate-spin text-gray-400" /> : <ImageIcon className="w-6 h-6 mx-auto text-gray-400" />}
                      <p className="mt-2 text-sm font-medium text-gray-700">{uploading ? 'Uploading…' : 'Upload image'}</p>
                      <p className="text-xs text-gray-400">A wide (landscape) image works best — PNG or JPG, under 8 MB</p>
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Title *</Label>
                    <Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Chhath Puja" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Animation</Label>
                    <select value={draft.effect} onChange={e => setDraft({ ...draft, effect: e.target.value as Effect })}
                      className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm">
                      {EFFECTS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Message under the image (optional)</Label>
                  <Input value={draft.message ?? ''} onChange={e => setDraft({ ...draft, message: e.target.value })}
                    placeholder="e.g. Team Distance Courses Wala ki taraf se Chhath Puja ki hardik shubhkamnayein" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Show from</Label>
                    <Input type="date" value={draft.starts_on} onChange={e => setDraft({ ...draft, starts_on: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Until (inclusive)</Label>
                    <Input type="date" value={draft.ends_on} min={draft.starts_on} onChange={e => setDraft({ ...draft, ends_on: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Show to</Label>
                  <div className="flex flex-wrap gap-2">
                    {AUDIENCES.map(a => {
                      const on = draft.audiences.includes(a.key)
                      return (
                        <label key={a.key} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${on ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                          <input type="checkbox" checked={on} className="h-4 w-4 accent-blue-600"
                            onChange={() => setDraft({ ...draft, audiences: on ? draft.audiences.filter(x => x !== a.key) : [...draft.audiences, a.key] })} />
                          {a.label}
                        </label>
                      )
                    })}
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">Active</span>
                  <Switch checked={draft.is_active} onCheckedChange={v => setDraft({ ...draft, is_active: Boolean(v) })} />
                </label>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
                  <Button onClick={save} disabled={saving || uploading}>
                    {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this greeting?"
        description={`"${deleteTarget?.title}" will stop showing on the dashboards.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
      />
    </div>
  )
}

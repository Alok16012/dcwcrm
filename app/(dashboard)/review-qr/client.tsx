'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import {
  Plus, Trash2, Pencil, Copy, Download, ExternalLink, QrCode, Save, X, Sparkles,
  ScanLine, ClipboardCheck, Star, Info, Loader2, Image as ImageIcon, FileCode2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { ReviewQrLanding } from '@/components/public/ReviewQrLanding'
import { createClient } from '@/lib/supabase/client'
import {
  SAMPLE_CATEGORIES, googleReviewLink, isGoogleReviewValue, newId, publicReviewUrl, slugify,
  type ReviewCategory, type ReviewQrPage,
} from '@/lib/review-qr'

/* eslint-disable @typescript-eslint/no-explicit-any */

// Review QR (migration 122): admin builds a page per business/branch, prints
// its QR, and customers who scan it land on /r/{slug}.

type Draft = Omit<ReviewQrPage, 'id' | 'scan_count' | 'copy_count' | 'google_open_count' | 'created_at'> & { id?: string }

const db = () => createClient() as any

const emptyDraft = (): Draft => ({
  slug: '', business_name: '', tagline: '', google_review_url: '', is_active: true,
  categories: SAMPLE_CATEGORIES.map(c => ({ ...c, id: newId(), reviews: [...c.reviews] })),
})

// ── QR images ───────────────────────────────────────────────────────────────

const QR_OPTS = { errorCorrectionLevel: 'H' as const, margin: 2, color: { dark: '#111827', light: '#ffffff' } }

function download(href: string, name: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** A print-ready card: business name, five stars, the QR and three steps. */
async function posterDataUrl(url: string, business: string): Promise<string> {
  const W = 1240, H = 1754 // A5 at 150 dpi
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const font = (w: number, px: number) => `${w} ${px}px Inter, "Segoe UI", Arial, sans-serif`

  g.fillStyle = '#fffbeb'; g.fillRect(0, 0, W, H)
  // Top band
  const grad = g.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, '#f59e0b'); grad.addColorStop(1, '#f97316')
  g.fillStyle = grad; g.fillRect(0, 0, W, 330)
  g.textAlign = 'center'; g.fillStyle = '#ffffff'
  g.font = font(700, 44); g.fillText('RATE US ON GOOGLE', W / 2, 110)
  let size = 84
  g.font = font(800, size)
  while (g.measureText(business).width > W - 140 && size > 40) { size -= 4; g.font = font(800, size) }
  g.fillText(business, W / 2, 225)

  // Stars
  g.fillStyle = '#f59e0b'; g.font = font(400, 120)
  g.fillText('★★★★★', W / 2, 520)
  g.fillStyle = '#111827'; g.font = font(800, 64)
  g.fillText('Scan karo & 5 Star do', W / 2, 640)

  // QR on a white card
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, url, { ...QR_OPTS, width: 760, margin: 1 })
  const cx = (W - 840) / 2, cy = 710
  g.fillStyle = '#ffffff'
  g.shadowColor = 'rgba(0,0,0,0.12)'; g.shadowBlur = 40; g.shadowOffsetY = 10
  g.beginPath(); g.roundRect(cx, cy, 840, 840, 48); g.fill()
  g.shadowColor = 'transparent'
  g.drawImage(qr, cx + 40, cy + 40, 760, 760)

  // Steps
  g.fillStyle = '#374151'; g.font = font(600, 40)
  g.fillText('1. Scan   •   2. Review chuno   •   3. Post', W / 2, 1640)
  g.fillStyle = '#9ca3af'; g.font = font(400, 28)
  g.fillText(url.replace(/^https?:\/\//, ''), W / 2, 1700)
  return c.toDataURL('image/png')
}

// ── Page ───────────────────────────────────────────────────────────────────

export function ReviewQrClient() {
  const [pages, setPages] = useState<ReviewQrPage[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [qrFor, setQrFor] = useState<ReviewQrPage | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ReviewQrPage | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await db().from('review_qr_pages').select('*').order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else setPages((data ?? []) as ReviewQrPage[])
    setLoading(false)
  }, [])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  // Local dev points the QR at this machine so it can be tested; live, the public domain.
  const urlOf = (slug: string) => publicReviewUrl(slug, typeof window === 'undefined' ? undefined : window.location.origin)

  async function save() {
    if (!draft) return
    const name = draft.business_name.trim()
    const slug = slugify(draft.slug || name)
    if (!name) return toast.error('Business ka naam daalo')
    if (!slug) return toast.error('Link ka naam daalo')
    if (!isGoogleReviewValue(draft.google_review_url)) return toast.error('Google review link ya Place ID sahi daalo')
    const categories = draft.categories
      .map(c => ({ ...c, name: c.name.trim(), reviews: c.reviews.map(r => r.trim()).filter(Boolean) }))
      .filter(c => c.name && c.reviews.length)
    setSaving(true)
    const { data: { user } } = await db().auth.getUser()
    const payload = {
      slug, business_name: name, tagline: draft.tagline?.trim() || null,
      google_review_url: draft.google_review_url.trim(), categories, is_active: draft.is_active,
    }
    const { error } = draft.id
      ? await db().from('review_qr_pages').update(payload).eq('id', draft.id)
      : await db().from('review_qr_pages').insert({ ...payload, created_by: user?.id ?? null })
    setSaving(false)
    if (error) {
      toast.error(error.code === '23505' ? `"${slug}" link pehle se kisi aur QR ka hai — doosra naam rakho` : error.message)
      return
    }
    toast.success('Saved — QR ready hai')
    setDraft(null)
    load()
  }

  async function toggle(p: ReviewQrPage) {
    const { error } = await db().from('review_qr_pages').update({ is_active: !p.is_active }).eq('id', p.id)
    if (error) toast.error(error.message)
    else load()
  }

  async function remove(p: ReviewQrPage) {
    const { error } = await db().from('review_qr_pages').delete().eq('id', p.id)
    setDeleteTarget(null)
    if (error) return toast.error(error.message)
    toast.success('Deleted')
    load()
  }

  if (draft) {
    return <Editor draft={draft} setDraft={setDraft} saving={saving} onSave={save} onClose={() => setDraft(null)} urlOf={urlOf} />
  }

  return (
    <div>
      <PageHeader
        title="Review QR"
        description="Ek QR jo customer ko seedha Google review tak le jaaye — ready-made reviews ke saath."
        action={<Button onClick={() => setDraft(emptyDraft())}><Plus className="w-4 h-4 mr-1" /> New QR</Button>}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : pages.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
            <QrCode className="w-7 h-7 text-amber-500" />
          </div>
          <p className="font-semibold text-gray-900">Abhi koi Review QR nahi hai</p>
          <p className="text-sm text-gray-500 mt-1 mb-5">Business ka naam aur Google review link daalo — QR turant ban jayega.</p>
          <Button onClick={() => setDraft(emptyDraft())}><Plus className="w-4 h-4 mr-1" /> Pehla QR banao</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pages.map(p => (
            <PageCard
              key={p.id} page={p} url={urlOf(p.slug)}
              onQr={() => setQrFor(p)}
              onEdit={() => setDraft({ ...p, tagline: p.tagline ?? '' })}
              onToggle={() => toggle(p)}
              onDelete={() => setDeleteTarget(p)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!qrFor} onOpenChange={o => { if (!o) setQrFor(null) }}>
        <DialogContent className="sm:max-w-lg">
          {qrFor && <QrPanel page={qrFor} url={urlOf(qrFor.slug)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="QR delete karein?"
        description={`"${deleteTarget?.business_name}" ka QR kaam karna band kar dega — jo QR print ho chuke hain wo bhi.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
      />
    </div>
  )
}

function PageCard({ page, url, onQr, onEdit, onToggle, onDelete }: {
  page: ReviewQrPage; url: string
  onQr: () => void; onEdit: () => void; onToggle: () => void; onDelete: () => void
}) {
  const [thumb, setThumb] = useState('')
  useEffect(() => { QRCode.toDataURL(url, { ...QR_OPTS, width: 240 }).then(setThumb, () => {}) }, [url])
  const reviews = page.categories.reduce((n, c) => n + c.reviews.length, 0)
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${page.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
      <div className="flex gap-4">
        <button onClick={onQr} className="shrink-0 rounded-xl border border-gray-100 p-1.5 hover:border-amber-300 transition" title="QR dekho / download">
          {thumb ? <img src={thumb} alt="QR" className="w-24 h-24" /> : <div className="w-24 h-24 bg-gray-50 rounded-lg" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-gray-900 truncate">{page.business_name}</p>
            <Switch checked={page.is_active} onCheckedChange={onToggle} />
          </div>
          <p className="text-xs text-gray-500 truncate">{page.tagline || ' '}</p>
          <p className="mt-1 text-[11px] font-mono text-blue-600 truncate">/r/{page.slug}</p>
          <p className="mt-1 text-[11px] text-gray-400">{page.categories.length} categories · {reviews} reviews</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat icon={ScanLine} label="Scans" value={page.scan_count} />
        <Stat icon={ClipboardCheck} label="Copied" value={page.copy_count} />
        <Stat icon={Star} label="Google opened" value={page.google_open_count} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onQr}><Download className="w-3.5 h-3.5 mr-1" /> QR download</Button>
        <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="w-3.5 h-3.5 mr-1" /> Edit</Button>
        <Button size="sm" variant="outline" onClick={() => window.open(url, '_blank')}><ExternalLink className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-50 py-2">
      <Icon className="w-3.5 h-3.5 mx-auto text-gray-400" />
      <p className="text-base font-extrabold text-gray-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  )
}

function QrPanel({ page, url }: { page: ReviewQrPage; url: string }) {
  const [png, setPng] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { QRCode.toDataURL(url, { ...QR_OPTS, width: 1024 }).then(setPng, () => {}) }, [url])
  const file = slugify(page.business_name) || 'review'

  async function downloadSvg() {
    const svg = await QRCode.toString(url, { ...QR_OPTS, type: 'svg', width: 1024 })
    download(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), `${file}-review-qr.svg`)
  }

  async function downloadPoster() {
    setBusy(true)
    try { download(await posterDataUrl(url, page.business_name), `${file}-review-poster.png`) }
    catch { toast.error('Poster nahi ban paya') }
    finally { setBusy(false) }
  }

  return (
    <div>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><QrCode className="w-4 h-4 text-amber-500" /> {page.business_name}</DialogTitle>
      </DialogHeader>
      <div className="mt-4 rounded-2xl bg-gradient-to-b from-amber-50 to-white border border-amber-100 p-5 text-center">
        <div className="flex justify-center gap-1 mb-3">
          {[0, 1, 2, 3, 4].map(i => <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />)}
        </div>
        {png ? <img src={png} alt="Review QR" className="mx-auto w-60 h-60 rounded-xl bg-white p-2 shadow-sm" /> : <div className="mx-auto w-60 h-60" />}
        <p className="mt-3 text-sm font-bold text-gray-900">Scan karo &amp; 5 Star do</p>
        <p className="text-[11px] font-mono text-gray-400 mt-1 break-all">{url}</p>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button onClick={downloadPoster} disabled={busy} className="bg-amber-500 hover:bg-amber-600">
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-1" />} Poster
        </Button>
        <Button variant="outline" onClick={() => png && download(png, `${file}-review-qr.png`)} disabled={!png}>
          <Download className="w-4 h-4 mr-1" /> QR PNG
        </Button>
        <Button variant="outline" onClick={downloadSvg}><FileCode2 className="w-4 h-4 mr-1" /> QR SVG</Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copied') }}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Link copy
        </Button>
        <Button variant="ghost" size="sm" onClick={() => window.open(url, '_blank')}>
          <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open page
        </Button>
      </div>
      <p className="mt-3 text-[11px] text-gray-400 text-center">
        Poster = print ke liye ready card (A5). SVG = printing press / bade size ke liye, kabhi blur nahi hota.
      </p>
    </div>
  )
}

// ── Editor ─────────────────────────────────────────────────────────────────

function Editor({ draft, setDraft, saving, onSave, onClose, urlOf }: {
  draft: Draft; setDraft: (d: Draft) => void; saving: boolean
  onSave: () => void; onClose: () => void; urlOf: (slug: string) => string
}) {
  const set = (p: Partial<Draft>) => setDraft({ ...draft, ...p })
  const slug = slugify(draft.slug || draft.business_name)
  const linkOk = isGoogleReviewValue(draft.google_review_url)
  const setCat = (id: string, p: Partial<ReviewCategory>) =>
    set({ categories: draft.categories.map(c => (c.id === id ? { ...c, ...p } : c)) })

  const preview = useMemo(() => ({
    slug: slug || 'preview',
    business_name: draft.business_name || 'Business name',
    tagline: draft.tagline || null,
    google_review_url: draft.google_review_url || 'preview',
    categories: draft.categories.map(c => ({ ...c, reviews: c.reviews.filter(r => r.trim()) })),
  }), [draft, slug])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">← All QR</button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" /> Cancel</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {/* Business */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <p className="font-bold text-gray-900">Business</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Business ka naam *</Label>
                <Input value={draft.business_name} onChange={e => set({ business_name: e.target.value })} placeholder="e.g. Distance Courses Wala" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tagline</Label>
                <Input value={draft.tagline ?? ''} onChange={e => set({ tagline: e.target.value })} placeholder="e.g. Kankarbagh, Patna" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">QR link</Label>
              <div className="flex items-center rounded-lg border border-input overflow-hidden">
                <span className="px-3 text-xs text-gray-400 bg-gray-50 h-9 flex items-center border-r whitespace-nowrap">…/r/</span>
                <input
                  value={draft.slug}
                  onChange={e => set({ slug: e.target.value })}
                  placeholder={slugify(draft.business_name) || 'my-business'}
                  disabled={!!draft.id}
                  className="flex-1 h-9 px-3 text-sm outline-none bg-transparent disabled:text-gray-500"
                />
              </div>
              <p className="text-[11px] text-gray-400">
                {draft.id ? 'Print hone ke baad link nahi badalta, warna purane QR band ho jaate.' : `Final: ${urlOf(slug || 'my-business')}`}
              </p>
            </div>
          </div>

          {/* Google */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <p className="font-bold text-gray-900">Google review link *</p>
            <div className="flex gap-2">
              <Input
                value={draft.google_review_url}
                onChange={e => set({ google_review_url: e.target.value })}
                placeholder="https://g.page/r/XXXXXXXX/review  ya  Place ID"
                className={draft.google_review_url && !linkOk ? 'border-red-300' : ''}
              />
              <Button variant="outline" disabled={!linkOk} onClick={() => window.open(googleReviewLink(draft.google_review_url), '_blank')}>
                Test <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 space-y-1">
              <p className="flex items-center gap-1.5 font-semibold"><Info className="w-3.5 h-3.5" /> Link kahan milega?</p>
              <p>Google pe apna business search karo (owner account se login) → <b>&quot;Ask for reviews&quot;</b> / <b>&quot;Get more reviews&quot;</b> → link copy karke yahan paste karo.</p>
              <p className="text-blue-700/80">Ya Place ID daalo — developers.google.com/maps/documentation/places/web-service/place-id pe business search karke milta hai.</p>
            </div>
          </div>

          {/* Categories */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-gray-900">Categories &amp; ready-made reviews</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Har line = ek review. Har category mein 5–10 alag-alag reviews rakho — customer ko inme se 10 tak, har baar naye order mein dikhte hain.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => set({
                  categories: [...draft.categories, ...SAMPLE_CATEGORIES
                    .filter(s => !draft.categories.some(c => c.name.trim().toLowerCase() === s.name.toLowerCase()))
                    .map(s => ({ ...s, id: newId(), reviews: [...s.reviews] }))],
                })}>
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Sample add
                </Button>
                <Button size="sm" onClick={() => set({ categories: [...draft.categories, { id: newId(), name: '', reviews: [] }] })}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Category
                </Button>
              </div>
            </div>

            {draft.categories.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">Koi category nahi — customer seedha Google pe jayega aur khud likhega.</p>
            )}

            {draft.categories.map(c => {
              const n = c.reviews.filter(r => r.trim()).length
              const good = n >= 5 && n <= 10
              return (
                <div key={c.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={c.name} onChange={e => setCat(c.id, { name: e.target.value })} placeholder="Category name, e.g. Staff Behaviour" className="font-semibold" />
                    <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2 py-1 ${good ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {n} review{n === 1 ? '' : 's'}
                    </span>
                    <Button size="icon-sm" variant="ghost" className="text-red-500 shrink-0"
                      onClick={() => set({ categories: draft.categories.filter(x => x.id !== c.id) })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={c.reviews.join('\n')}
                    onChange={e => setCat(c.id, { reviews: e.target.value.split('\n') })}
                    rows={Math.min(10, Math.max(4, c.reviews.length + 1))}
                    placeholder={'Ek line mein ek review…\nDoosra review…'}
                    className="text-sm leading-relaxed"
                  />
                  {!good && <p className="text-[11px] text-amber-600">{n < 5 ? 'Kam se kam 5 reviews rakho, taaki sab customer same text na chunein.' : '10 se zyada hain — har baar random 10 dikhenge.'}</p>}
                </div>
              )
            })}

            <label className="flex items-center justify-between gap-2 pt-1 text-sm text-gray-700 font-medium">
              QR active hai
              <Switch checked={draft.is_active} onCheckedChange={v => set({ is_active: Boolean(v) })} />
            </label>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 space-y-1">
            <p className="font-semibold">Google ke rules — dhyan rakhein</p>
            <p>• Stars customer khud Google par tap karta hai; koi bhi page unhe pehle se nahi bhar sakta.</p>
            <p>• Review ke badle discount/gift dena, ya kam rating walon ko Google se rokna, Google ki policy ke khilaf hai.</p>
            <p>• Bahut saare ek jaise reviews Google hata deta hai — isliye alag-alag texts rakhein, customer edit bhi kar sakta hai.</p>
          </div>
        </div>

        {/* Live preview */}
        <div className="xl:sticky xl:top-4 self-start">
          <p className="text-xs font-semibold text-gray-500 mb-2">Live preview — customer ko aisa dikhega</p>
          <div className="mx-auto w-[360px] max-w-full h-[680px] rounded-[2.5rem] border-[10px] border-gray-900 overflow-hidden shadow-2xl bg-white">
            <div className="h-full overflow-y-auto [transform:translateZ(0)]">
              <ReviewQrLanding key={JSON.stringify(preview.categories.map(c => c.id))} page={preview} preview />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

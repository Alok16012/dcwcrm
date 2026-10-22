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
  SAMPLE_CATEGORIES, copyToClipboard, googleReviewLink, isGoogleReviewValue, newId, openInNewTab,
  publicReviewUrl, saveImage, slugify, type ReviewCategory, type ReviewQrPage,
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

/** A print-ready A5 card: business name, five stars, the QR and three steps. */
async function posterBlob(url: string, business: string, tagline: string | null): Promise<Blob> {
  const W = 1240, H = 1754 // A5 at 150 dpi
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const font = (w: number, px: number) => `${w} ${px}px Inter, "Segoe UI", Helvetica, Arial, sans-serif`
  const fit = (text: string, w: number, px: number, max: number) => {
    let size = px
    g.font = font(w, size)
    while (g.measureText(text).width > max && size > 24) { size -= 2; g.font = font(w, size) }
  }
  g.textAlign = 'center'

  // Page and navy header
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H)
  g.fillStyle = '#0f172a'; g.fillRect(0, 0, W, 400)
  // Four-colour accent rule under the header
  ;['#4285F4', '#EA4335', '#FBBC04', '#34A853'].forEach((col, i) => {
    g.fillStyle = col; g.fillRect((W / 4) * i, 400, W / 4, 12)
  })
  g.fillStyle = '#94a3b8'; g.font = font(600, 34)
  g.fillText('R E V I E W   U S   O N   G O O G L E', W / 2, 120)
  g.fillStyle = '#ffffff'; fit(business, 700, 78, W - 160)
  g.fillText(business, W / 2, tagline ? 245 : 270)
  if (tagline) { g.fillStyle = '#cbd5e1'; fit(tagline, 400, 38, W - 200); g.fillText(tagline, W / 2, 320) }

  // Stars and headline
  g.fillStyle = '#FBBC04'; g.font = font(400, 110)
  g.fillText('★★★★★', W / 2, 590)
  g.fillStyle = '#0f172a'; g.font = font(700, 58)
  g.fillText('Enjoyed your experience?', W / 2, 700)
  g.fillStyle = '#475569'; g.font = font(400, 38)
  g.fillText('Scan the code and leave us a 5-star review.', W / 2, 765)

  // QR inside a bordered card
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, url, { ...QR_OPTS, width: 640, margin: 1 })
  const size = 720, cx = (W - size) / 2, cy = 830
  g.fillStyle = '#ffffff'; g.strokeStyle = '#e2e8f0'; g.lineWidth = 4
  g.beginPath(); g.roundRect(cx, cy, size, size, 40); g.fill(); g.stroke()
  g.drawImage(qr, cx + 40, cy + 40, 640, 640)

  // Steps
  const steps = ['Scan', 'Choose a review', 'Post on Google']
  const colW = (W - 160) / 3
  steps.forEach((label, i) => {
    const x = 80 + colW * i + colW / 2
    g.fillStyle = '#1a73e8'
    g.beginPath(); g.arc(x, 1640, 30, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#ffffff'; g.font = font(700, 32); g.fillText(String(i + 1), x, 1651)
    g.fillStyle = '#334155'; g.font = font(600, 32); g.fillText(label, x, 1712)
  })
  return new Promise<Blob>((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'))
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
    if (!name) return toast.error('Enter the business name')
    if (!slug) return toast.error('Enter a link name')
    if (!isGoogleReviewValue(draft.google_review_url)) return toast.error('Enter a valid Google review link or Place ID')
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
      toast.error(error.code === '23505' ? `The link "${slug}" is already in use. Please choose another.` : error.message)
      return
    }
    toast.success('Saved. Your QR code is ready.')
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
        description="Printable QR codes that take customers straight to your Google review page, with ready-to-use reviews."
        action={<Button onClick={() => setDraft(emptyDraft())}><Plus className="w-4 h-4 mr-1" /> New QR Code</Button>}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : pages.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
            <QrCode className="w-7 h-7 text-[#1a73e8]" />
          </div>
          <p className="font-semibold text-gray-900">No review QR codes yet</p>
          <p className="text-sm text-gray-500 mt-1 mb-5">Add your business name and Google review link to generate a QR code.</p>
          <Button onClick={() => setDraft(emptyDraft())}><Plus className="w-4 h-4 mr-1" /> Create QR Code</Button>
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
        title="Delete this QR code?"
        description={`The QR code for "${deleteTarget?.business_name}" will stop working, including any copies already printed.`}
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
        <button onClick={onQr} className="shrink-0 rounded-xl border border-gray-100 p-1.5 hover:border-[#1a73e8]/40 transition" title="View and download">
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
        <Stat icon={Star} label="Sent to Google" value={page.google_open_count} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onQr}><Download className="w-3.5 h-3.5 mr-1" /> Download</Button>
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
  const [busy, setBusy] = useState<'poster' | 'png' | 'svg' | null>(null)
  useEffect(() => { QRCode.toDataURL(url, { ...QR_OPTS, width: 1024 }).then(setPng, () => {}) }, [url])
  const file = slugify(page.business_name) || 'review'

  async function afterSave(result: Awaited<ReturnType<typeof saveImage>>) {
    if (result === 'downloaded') toast.success('Downloaded')
    // 'shared' and 'cancelled' need no toast — the share sheet already told the story.
  }

  async function downloadSvg() {
    setBusy('svg')
    try {
      const svg = await QRCode.toString(url, { ...QR_OPTS, type: 'svg', width: 1024 })
      await afterSave(await saveImage(new Blob([svg], { type: 'image/svg+xml' }), `${file}-review-qr.svg`, page.business_name))
    } catch { toast.error('Could not create the QR code') }
    finally { setBusy(null) }
  }

  async function downloadPng() {
    if (!png) return
    setBusy('png')
    try {
      const blob = await (await fetch(png)).blob()
      await afterSave(await saveImage(blob, `${file}-review-qr.png`, page.business_name))
    } catch { toast.error('Could not save the QR code') }
    finally { setBusy(null) }
  }

  async function copyLink() {
    const ok = await copyToClipboard(url)
    if (ok) toast.success('Link copied')
    else toast.error('Could not copy — please copy it manually')
  }

  async function downloadPoster() {
    setBusy('poster')
    try {
      const blob = await posterBlob(url, page.business_name, page.tagline)
      await afterSave(await saveImage(blob, `${file}-review-poster.png`, page.business_name))
    }
    catch { toast.error('Could not create the poster') }
    finally { setBusy(null) }
  }

  return (
    <div>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><QrCode className="w-4 h-4 text-[#1a73e8]" /> {page.business_name}</DialogTitle>
      </DialogHeader>
      <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-5 text-center">
        <div className="flex justify-center gap-1 mb-3">
          {[0, 1, 2, 3, 4].map(i => <Star key={i} className="w-5 h-5 fill-[#FBBC04] text-[#FBBC04]" />)}
        </div>
        {png ? <img src={png} alt="Review QR" className="mx-auto w-60 h-60 rounded-xl bg-white p-2 shadow-sm" /> : <div className="mx-auto w-60 h-60" />}
        <p className="mt-3 text-sm font-bold text-gray-900">Scan to leave a 5-star review</p>
        <p className="text-[11px] font-mono text-gray-400 mt-1 break-all">{url}</p>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button onClick={downloadPoster} disabled={!!busy} className="bg-[#1a73e8] hover:bg-[#1765cc]">
          {busy === 'poster' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-1" />} Print Poster
        </Button>
        <Button variant="outline" onClick={downloadPng} disabled={!png || !!busy}>
          {busy === 'png' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />} QR PNG
        </Button>
        <Button variant="outline" onClick={downloadSvg} disabled={!!busy}>
          {busy === 'svg' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileCode2 className="w-4 h-4 mr-1" />} QR SVG
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="ghost" size="sm" onClick={copyLink}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Copy link
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openInNewTab(url)}>
          <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open page
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-gray-400 text-center sm:hidden">
        On your phone, saving opens the share sheet — choose <b>Save Image</b> to add it to Photos.
      </p>
      <p className="mt-3 text-[11px] text-gray-400 text-center">
        Print Poster: a ready-to-print A5 card. SVG: for print shops and large formats; stays sharp at any size.
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
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">← All QR codes</button>
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
                <Label className="text-xs">Business name *</Label>
                <Input value={draft.business_name} onChange={e => set({ business_name: e.target.value })} placeholder="e.g. Distance Courses Wala" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tagline</Label>
                <Input value={draft.tagline ?? ''} onChange={e => set({ tagline: e.target.value })} placeholder="e.g. Kankarbagh, Patna" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Page link</Label>
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
                {draft.id ? 'The link can’t be changed after saving, so printed QR codes keep working.' : `QR code opens: ${urlOf(slug || 'my-business')}`}
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
                placeholder="https://g.page/r/XXXXXXXX/review or a Place ID"
                className={draft.google_review_url && !linkOk ? 'border-red-300' : ''}
              />
              <Button variant="outline" disabled={!linkOk} onClick={() => window.open(googleReviewLink(draft.google_review_url), '_blank')}>
                Test <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 space-y-1">
              <p className="flex items-center gap-1.5 font-semibold"><Info className="w-3.5 h-3.5" /> Where do I find this link?</p>
              <p>Sign in to the Google account that manages your Business Profile, search for your business on Google, choose <b>&quot;Ask for reviews&quot;</b> (or <b>&quot;Get more reviews&quot;</b>), and copy the link.</p>
              <p className="text-blue-700/80">Alternatively, paste your Place ID, which you can look up with Google’s Place ID Finder.</p>
            </div>
          </div>

          {/* Categories */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-gray-900">Categories and suggested reviews</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  One review per line. Keep 5–10 varied reviews in each category; customers see up to 10, in a different order each time.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => set({
                  categories: [...draft.categories, ...SAMPLE_CATEGORIES
                    .filter(s => !draft.categories.some(c => c.name.trim().toLowerCase() === s.name.toLowerCase()))
                    .map(s => ({ ...s, id: newId(), reviews: [...s.reviews] }))],
                })}>
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Add samples
                </Button>
                <Button size="sm" onClick={() => set({ categories: [...draft.categories, { id: newId(), name: '', reviews: [] }] })}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add category
                </Button>
              </div>
            </div>

            {draft.categories.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No categories. Customers will go straight to Google and write their own review.</p>
            )}

            {draft.categories.map(c => {
              const n = c.reviews.filter(r => r.trim()).length
              const good = n >= 5 && n <= 10
              return (
                <div key={c.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={c.name} onChange={e => setCat(c.id, { name: e.target.value })} placeholder="Category name, e.g. Staff & Service" className="font-semibold" />
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
                    placeholder={'One review per line…\nAnother review…'}
                    className="text-sm leading-relaxed"
                  />
                  {!good && <p className="text-[11px] text-amber-700">{n < 5 ? 'Add at least 5 reviews so customers don’t all post the same text.' : 'More than 10 reviews: customers will see a random 10.'}</p>}
                </div>
              )
            })}

            <label className="flex items-center justify-between gap-2 pt-1 text-sm text-gray-700 font-medium">
              Active
              <Switch checked={draft.is_active} onCheckedChange={v => set({ is_active: Boolean(v) })} />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Google review guidelines</p>
            <p>• Customers select the star rating themselves on Google; no page can pre-fill it.</p>
            <p>• Offering discounts or gifts for reviews, or steering unhappy customers away from Google, is against Google’s policy.</p>
            <p>• Google may remove many identical reviews, so keep the suggestions varied. Customers can edit before posting.</p>
          </div>
        </div>

        {/* Live preview */}
        <div className="xl:sticky xl:top-4 self-start">
          <p className="text-xs font-semibold text-gray-500 mb-2">Live preview: what customers see</p>
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

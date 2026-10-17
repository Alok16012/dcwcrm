'use client'
import { useEffect, useMemo, useState } from 'react'
import { Star, ChevronLeft, Copy, Check, ArrowUpRight, PenLine, ChevronRight, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { googleReviewLink, type PublicReviewPage, type ReviewCategory } from '@/lib/review-qr'

// What a customer sees after scanning a Review QR. Google never lets a page
// fill in the stars, so this page does everything else: picks the words,
// copies them, opens Google's review box, and shows where to tap.

type Step = 'start' | 'category' | 'pick'

const STAR = 'fill-[#FBBC04] text-[#FBBC04]'

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older in-app browsers: fall back to a hidden textarea.
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

function Stars({ size = 'w-9 h-9', animate = false }: { size?: string; animate?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2, 3, 4].map(i => (
        <Star
          key={i}
          className={`${size} ${STAR} ${animate ? 'rqr-pop' : ''}`}
          style={animate ? { animationDelay: `${i * 80}ms` } : undefined}
        />
      ))}
    </div>
  )
}

function StepNo({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 rounded-full bg-[#1a73e8] text-white text-xs font-semibold flex items-center justify-center shrink-0">{n}</span>
  )
}

export function ReviewQrLanding({ page, preview = false }: { page: PublicReviewPage; preview?: boolean }) {
  const categories = useMemo(
    () => (page.categories ?? []).filter((c: ReviewCategory) => c.name.trim() && c.reviews.some(r => r.trim())),
    [page.categories],
  )
  const [step, setStep] = useState<Step>('start')
  const [category, setCategory] = useState<ReviewCategory | null>(null)
  const [options, setOptions] = useState<string[]>([])
  const [text, setText] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const link = googleReviewLink(page.google_review_url)

  function track(event: 'scan' | 'copy' | 'google') {
    if (preview) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the rpc isn't in the generated types
      ;(createClient() as any).rpc('review_qr_track', { p_slug: page.slug, p_event: event }).then(() => {}, () => {})
    } catch { /* counting is best-effort */ }
  }

  // One scan per visit, not per refresh.
  useEffect(() => {
    if (preview) return
    try {
      const key = `rqr-scan-${page.slug}`
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { /* storage blocked: count anyway */ }
    track('scan')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.slug, preview])

  function openGoogle() {
    track('google')
    if (preview) window.open(link, '_blank', 'noopener')
    else window.location.href = link
  }

  function start() {
    if (categories.length === 0) { openGoogle(); return }
    if (categories.length === 1) { pickCategory(categories[0]); return }
    setStep('category')
  }

  function pickCategory(c: ReviewCategory) {
    setCategory(c)
    // A fresh order on every visit, so customers don't all pick the first one.
    setOptions(shuffle(c.reviews.map(r => r.trim()).filter(Boolean)).slice(0, 10))
    setStep('pick')
  }

  async function copyAndGo() {
    if (text == null) return
    const ok = await copyText(text.trim())
    if (ok) { setCopied(true); track('copy') }
    openGoogle()
  }

  const initial = page.business_name.trim().charAt(0).toUpperCase() || '★'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <style>{`
        @keyframes rqr-pop { 0% { transform: scale(0.4); opacity: 0 } 70% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
        .rqr-pop { animation: rqr-pop 380ms cubic-bezier(.2,.8,.3,1.2) both }
        @keyframes rqr-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .rqr-up { animation: rqr-up 240ms ease-out both }
        @keyframes rqr-fade { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        .rqr-fade { animation: rqr-fade 220ms ease-out both }
        @keyframes rqr-tap { 0%,100% { transform: scale(1) } 50% { transform: scale(1.3) } }
        .rqr-tap { animation: rqr-tap 1.1s ease-in-out infinite }
      `}</style>

      {/* Brand header */}
      <div className="bg-[#0f172a] text-white">
        <div className="max-w-md mx-auto px-5 pt-8 pb-14 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center text-2xl font-bold">
            {initial}
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight leading-snug">{page.business_name}</h1>
          {page.tagline && <p className="mt-1 text-sm text-slate-300">{page.tagline}</p>}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-9 pb-10">
        {step === 'start' && (
          <div className="rqr-fade bg-white rounded-2xl ring-1 ring-slate-200 shadow-lg shadow-slate-200/70 p-6 text-center">
            <Stars size="w-10 h-10" animate />
            <h2 className="mt-5 text-lg font-semibold">How was your experience?</h2>
            <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
              Your review helps others choose with confidence. It takes less than 30 seconds.
            </p>
            <button
              onClick={start}
              className="mt-6 w-full rounded-xl bg-[#1a73e8] hover:bg-[#1765cc] text-white font-semibold text-base py-3.5 shadow-md shadow-blue-200 active:scale-[0.98] transition"
            >
              Write a 5-Star Review
            </button>
            <button onClick={openGoogle} className="mt-3 w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-700">
              I&apos;d rather write my own
            </button>
          </div>
        )}

        {step === 'category' && (
          <div className="rqr-fade bg-white rounded-2xl ring-1 ring-slate-200 shadow-lg shadow-slate-200/70 p-5">
            <button onClick={() => setStep('start')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 -ml-1 mb-3">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="text-base font-semibold">What would you like to review?</h2>
            <p className="text-sm text-slate-500 mt-0.5 mb-4">Choose a topic</p>
            <div className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200 overflow-hidden">
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => pickCategory(c)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-blue-50 transition"
                >
                  {c.name}
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'pick' && category && (
          <div className="rqr-fade bg-white rounded-2xl ring-1 ring-slate-200 shadow-lg shadow-slate-200/70 p-5">
            <button
              onClick={() => setStep(categories.length > 1 ? 'category' : 'start')}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 -ml-1 mb-3"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="text-base font-semibold">{category.name}</h2>
            <p className="text-sm text-slate-500 mt-0.5 mb-4">Tap the review that matches your experience. You can edit it before posting.</p>
            <div className="space-y-2.5">
              {options.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { setText(r); setCopied(false) }}
                  className="w-full text-left rounded-xl ring-1 ring-slate-200 bg-white px-4 py-3.5 hover:ring-[#1a73e8]/50 hover:bg-blue-50/40 active:scale-[0.99] transition"
                >
                  <div className="flex gap-0.5 mb-1.5">
                    {[0, 1, 2, 3, 4].map(s => <Star key={s} className={`w-3.5 h-3.5 ${STAR}`} />)}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{r}</p>
                </button>
              ))}
              <button
                onClick={() => { setText(''); setCopied(false) }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <PenLine className="w-4 h-4" /> Write in my own words
              </button>
            </div>
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5" /> Your review is posted on Google from your own account.
        </p>
      </div>

      {/* Bottom sheet: the chosen words + how to finish on Google */}
      {text != null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50" onClick={() => setText(null)}>
          <div
            className="rqr-up w-full max-w-md bg-white rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-slate-200 mb-4" />
            <p className="text-sm font-semibold mb-2">Your review</p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              placeholder="Share a few words about your experience…"
              className="w-full rounded-xl ring-1 ring-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
            />

            <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">On the Google page</p>
              <ol className="space-y-2.5 text-sm text-slate-700">
                <li className="flex items-center gap-2.5">
                  <StepNo n={1} />
                  <span className="flex items-center flex-wrap gap-1">Tap the fifth star
                    <span className="flex ml-1">
                      {[0, 1, 2, 3].map(s => <Star key={s} className={`w-4 h-4 ${STAR}`} />)}
                      <Star className={`w-4 h-4 ${STAR} rqr-tap`} />
                    </span>
                  </span>
                </li>
                <li className="flex items-center gap-2.5"><StepNo n={2} /><span>Press and hold the text box, then tap <b className="font-semibold">Paste</b></span></li>
                <li className="flex items-center gap-2.5"><StepNo n={3} /><span>Tap <b className="font-semibold">Post</b></span></li>
              </ol>
            </div>

            <button
              onClick={copyAndGo}
              disabled={!text.trim()}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-[#1a73e8] hover:bg-[#1765cc] text-white font-semibold text-base py-3.5 shadow-md shadow-blue-200 active:scale-[0.98] transition disabled:opacity-50"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              Copy &amp; Continue to Google
              <ArrowUpRight className="w-4 h-4 opacity-80" />
            </button>
            <button onClick={() => setText(null)} className="mt-2 w-full py-2 text-sm font-medium text-slate-500">Choose a different review</button>
          </div>
        </div>
      )}
    </div>
  )
}

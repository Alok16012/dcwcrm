'use client'
import { useEffect, useMemo, useState } from 'react'
import { Star, ChevronLeft, Copy, Check, ExternalLink, PenLine, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { googleReviewLink, type PublicReviewPage, type ReviewCategory } from '@/lib/review-qr'

// What a customer sees after scanning a Review QR. Google never lets a page
// fill in the stars, so this page does everything else: picks the words,
// copies them, opens Google's review box, and shows where to tap.

type Step = 'start' | 'category' | 'pick'

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
          className={`${size} fill-amber-400 text-amber-400 drop-shadow-sm ${animate ? 'rqr-pop' : ''}`}
          style={animate ? { animationDelay: `${i * 90}ms` } : undefined}
        />
      ))}
    </div>
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-white">
      <style>{`
        @keyframes rqr-pop { 0% { transform: scale(0.3) rotate(-20deg); opacity: 0 } 70% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
        .rqr-pop { animation: rqr-pop 420ms cubic-bezier(.2,.8,.3,1.2) both }
        @keyframes rqr-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .rqr-up { animation: rqr-up 260ms ease-out both }
        @keyframes rqr-tap { 0%,100% { transform: scale(1) } 50% { transform: scale(1.25) } }
        .rqr-tap { animation: rqr-tap 1s ease-in-out infinite }
      `}</style>

      <div className="max-w-md mx-auto px-4 pb-10">
        {/* Header */}
        <div className="pt-8 pb-5 text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] text-amber-600 uppercase">Rate us on Google</p>
          <h1 className="mt-1.5 text-2xl font-extrabold text-gray-900 leading-tight">{page.business_name}</h1>
          {page.tagline && <p className="mt-1 text-sm text-gray-500">{page.tagline}</p>}
        </div>

        {step === 'start' && (
          <div className="bg-white rounded-3xl border border-amber-100 shadow-xl shadow-amber-100/60 p-6 text-center">
            <Stars size="w-11 h-11" animate />
            <p className="mt-5 text-lg font-bold text-gray-900">Aapka experience kaisa raha?</p>
            <p className="mt-1 text-sm text-gray-500">Sirf 10 second — ek review humein bahut help karta hai 🙏</p>
            <button
              onClick={start}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-extrabold text-lg py-4 shadow-lg shadow-orange-200 active:scale-[0.98] transition-transform"
            >
              ⭐⭐⭐⭐⭐ &nbsp;5 Star Review Do
            </button>
            <button onClick={openGoogle} className="mt-4 text-xs text-gray-400 underline underline-offset-2">
              Apna review khud likhna hai? Seedha Google kholo
            </button>
          </div>
        )}

        {step === 'category' && (
          <div>
            <button onClick={() => setStep('start')} className="flex items-center gap-1 text-sm text-gray-500 mb-3">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <p className="text-base font-bold text-gray-900">Kis baare mein review dena hai?</p>
            <p className="text-xs text-gray-500 mt-0.5 mb-4">Ek option chuniye</p>
            <div className="grid grid-cols-2 gap-3">
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => pickCategory(c)}
                  className="rounded-2xl bg-white border border-gray-200 px-3 py-4 text-sm font-semibold text-gray-800 shadow-sm active:scale-[0.97] active:bg-amber-50 hover:border-amber-300 transition text-left"
                >
                  <Sparkles className="w-4 h-4 text-amber-500 mb-1.5" />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'pick' && category && (
          <div>
            <button
              onClick={() => setStep(categories.length > 1 ? 'category' : 'start')}
              className="flex items-center gap-1 text-sm text-gray-500 mb-3"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <p className="text-base font-bold text-gray-900">{category.name}</p>
            <p className="text-xs text-gray-500 mt-0.5 mb-4">Jo review aapko sahi lage us par tap kijiye — chahein to badal bhi sakte hain</p>
            <div className="space-y-2.5">
              {options.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { setText(r); setCopied(false) }}
                  className="w-full text-left rounded-2xl bg-white border border-gray-200 px-4 py-3.5 shadow-sm active:scale-[0.99] hover:border-amber-300 transition"
                >
                  <div className="flex gap-0.5 mb-1.5">
                    {[0, 1, 2, 3, 4].map(s => <Star key={s} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{r}</p>
                </button>
              ))}
              <button
                onClick={() => { setText(''); setCopied(false) }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 px-4 py-3 text-sm font-semibold text-gray-500"
              >
                <PenLine className="w-4 h-4" /> Apne shabdon mein likhein
              </button>
            </div>
          </div>
        )}

        <p className="mt-10 text-center text-[10px] text-gray-300">Powered by Blinks AI</p>
      </div>

      {/* Bottom sheet: the chosen words + how to finish on Google */}
      {text != null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setText(null)}>
          <div
            className="rqr-up w-full max-w-md bg-white rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-gray-200 mb-4" />
            <p className="text-sm font-bold text-gray-900 mb-2">Aapka review</p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              placeholder="Yahan apna review likhiye…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-300"
            />

            <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-100 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-2">Google par bas 3 kaam</p>
              <ol className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                  <span className="flex items-center gap-1">5th star par tap karein
                    <span className="flex ml-1">
                      {[0, 1, 2, 3].map(s => <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 rqr-tap" />
                    </span>
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                  Box par long-press karke <b>Paste</b> karein
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                  <b>Post</b> par tap karein — ho gaya! 🎉
                </li>
              </ol>
            </div>

            <button
              onClick={copyAndGo}
              disabled={!text.trim()}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-extrabold text-base py-4 shadow-lg shadow-orange-200 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              Copy karo &amp; Google kholo
              <ExternalLink className="w-4 h-4 opacity-80" />
            </button>
            <button onClick={() => setText(null)} className="mt-2 w-full py-2 text-sm text-gray-400">Doosra review chunein</button>
          </div>
        </div>
      )}
    </div>
  )
}

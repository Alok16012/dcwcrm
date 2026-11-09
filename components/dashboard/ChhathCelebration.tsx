'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { ChhathHero, ChhathPetals, ChhathStyles } from './ChhathTheme'
import { isChhath, todayIST } from './festival'

/**
 * The Chhath wish as a moment, like the Diwali fireworks were: on a phone it
 * plays by itself once a day per browser — the festival scene over the page
 * for a few seconds, then it fades away. A small sun in the corner replays
 * it on any screen.
 */

const SHOW_MS = 7000
const STORAGE_KEY = 'dcw-chhath-shown'

// One of these is picked each time the wish opens, so the sun says something new.
const WISHES = [
  'छठी मैया आपके जीवन को सुख, समृद्धि और ढेर सारी खुशियों से भर दें।',
  'सूर्य देव की पहली किरण आपके जीवन में नई ऊर्जा, उत्साह और सफलता लाए।',
  'उगते सूरज की तरह आपका हर दिन रोशन हो — छठ महापर्व की हार्दिक शुभकामनाएं।',
  'छठ महापर्व आपके परिवार में अच्छा स्वास्थ्य, शांति और सौभाग्य लेकर आए।',
  'डूबते और उगते सूरज को अर्घ्य के साथ आपकी हर मनोकामना पूरी हो।',
]

function readSeen(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

export function ChhathCelebration({ name }: { name?: string }) {
  const [today] = useState(todayIST)
  const [playing, setPlaying] = useState(false)
  // Opened from the sun: stays until closed. Auto-played: leaves by itself.
  const [manual, setManual] = useState(false)
  const [wish, setWish] = useState(0)

  // Phones get it automatically, once a day; bigger screens have the scene
  // on the page already and replay it from the sun.
  useEffect(() => {
    if (!isChhath(today) || readSeen() === today) return
    if (!window.matchMedia('(max-width: 767px)').matches) return
    void Promise.resolve().then(() => { setWish(Math.floor(Math.random() * WISHES.length)); setPlaying(true) })
  }, [today])

  useEffect(() => {
    if (!playing) return
    try { localStorage.setItem(STORAGE_KEY, today) } catch { /* ignore */ }
    if (manual) return
    const t = setTimeout(() => setPlaying(false), SHOW_MS)
    return () => clearTimeout(t)
  }, [playing, manual, today])

  const stop = useCallback(() => { setPlaying(false); setManual(false) }, [])
  const openFromSun = () => {
    setWish(w => (w + 1 + Math.floor(Math.random() * (WISHES.length - 1))) % WISHES.length)
    setManual(true)
    setPlaying(true)
  }
  const first = (name ?? '').trim().split(/\s+/)[0]

  if (!isChhath(today)) return null

  return (
    <>
      <ChhathStyles />
      {playing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-3" onClick={stop}>
          <div className={`${manual ? 'chc-sky-in' : 'chc-sky'} absolute inset-0 bg-gradient-to-b from-orange-200/95 via-amber-100/95 to-sky-200/95 backdrop-blur-sm`} />
          <ChhathPetals />
          <div className={`${manual ? 'chc-card-in' : 'chc-card'} relative w-full max-w-3xl overflow-hidden rounded-3xl bg-gradient-to-b from-orange-50 to-amber-50 shadow-2xl shadow-orange-500/30 ring-1 ring-amber-200`}
            onClick={e => e.stopPropagation()}>
            <ChhathHero id="popup" subtitle={false} />
            {/* The personal wish */}
            <div className="chc-wish relative px-5 pb-6 pt-4 text-center">
              {first && <p className="text-lg md:text-xl font-bold text-rose-900">{first} ji,</p>}
              <p key={wish} className="chc-wish-text mx-auto mt-1 max-w-xl text-base md:text-lg leading-relaxed text-gray-800">{WISHES[wish]}</p>
              <p className="mt-3 text-sm font-semibold text-orange-700">— Team Distance Courses Wala 🙏</p>
            </div>
            <button onClick={stop} aria-label="Close"
              className="absolute right-3 top-14 z-30 rounded-full bg-white/80 p-1.5 text-gray-600 shadow hover:bg-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* The sun: tap to see the wish again */}
      {!playing && (
        <button onClick={openFromSun} title="Aapke liye Chhath Puja ki shubhkamna ☀️" aria-label="Show your Chhath Puja wish"
          className="chc-sun fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40 h-16 w-16 rounded-full bg-white/70 backdrop-blur transition-transform hover:scale-110 active:scale-95">
          <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_0_12px_rgba(251,146,60,0.75)]" aria-hidden>
            <defs>
              <radialGradient id="chc-disc" cx="45%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#fffbeb" />
                <stop offset="45%" stopColor="#fcd34d" />
                <stop offset="100%" stopColor="#f97316" />
              </radialGradient>
              <clipPath id="chc-above"><rect width="100" height="62" /></clipPath>
            </defs>
            {/* sun rising out of the water */}
            <g clipPath="url(#chc-above)">
              <g className="chc-rays" style={{ transformOrigin: '50px 60px' }}>
                {Array.from({ length: 12 }, (_, i) => (
                  <rect key={i} x="47.5" y="14" width="5" height="13" rx="2.5" fill="#f59e0b" transform={`rotate(${i * 30} 50 60)`} />
                ))}
              </g>
              <circle cx="50" cy="60" r="24" fill="url(#chc-disc)" />
            </g>
            <path className="chc-ripple" d="M 6 66 Q 17 60 28 66 T 50 66 T 72 66 T 94 66" stroke="#0ea5e9" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path className="chc-ripple" d="M 14 78 Q 25 72 36 78 T 58 78 T 80 78 T 90 78" stroke="#38bdf8" strokeWidth="3.5" fill="none" strokeLinecap="round" style={{ animationDelay: '0.5s' }} />
          </svg>
        </button>
      )}

      <style>{`
        .chc-sky { animation: chc-sky ${SHOW_MS}ms ease-in-out both; }
        @keyframes chc-sky { 0% { opacity: 0; } 8% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; } }
        .chc-card { animation: chc-card ${SHOW_MS}ms cubic-bezier(0.2, 1.2, 0.4, 1) both; }
        @keyframes chc-card {
          0% { opacity: 0; transform: translateY(24px) scale(0.92); }
          9% { opacity: 1; transform: none; }
          86% { opacity: 1; transform: none; }
          100% { opacity: 0; transform: translateY(-12px) scale(0.98); }
        }
        .chc-sky-in { animation: chc-fade 0.5s ease-out both; }
        @keyframes chc-fade { from { opacity: 0; } to { opacity: 1; } }
        .chc-card-in { animation: chc-pop 0.6s cubic-bezier(0.2, 1.3, 0.4, 1) both; }
        @keyframes chc-pop { from { opacity: 0; transform: translateY(24px) scale(0.92); } to { opacity: 1; transform: none; } }
        .chc-wish-text { animation: chc-pop 0.7s 0.5s cubic-bezier(0.2, 1.2, 0.4, 1) both; }
        .chc-rays { animation: chc-spin 12s linear infinite; }
        .chc-ripple { animation: chc-ripple 2s ease-in-out infinite; }
        @keyframes chc-ripple { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(3px); } }
        @keyframes chc-spin { to { transform: rotate(360deg); } }
        .chc-sun { animation: chc-glow 2.6s ease-in-out infinite; border-radius: 9999px; }
        @keyframes chc-glow { 0%, 100% { box-shadow: 0 0 12px 3px rgba(251,146,60,0.35); } 50% { box-shadow: 0 0 26px 8px rgba(251,191,36,0.6); } }
        @media (prefers-reduced-motion: reduce) {
          .chc-sky, .chc-sky-in, .chc-card, .chc-card-in, .chc-wish-text, .chc-rays, .chc-sun, .chc-ripple { animation: none; }
        }
      `}</style>
    </>
  )
}

'use client'
import { useEffect, useMemo, useState } from 'react'
import { X, PartyPopper } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * A festival greeting (migration 124) on a dashboard: the admin's image with
 * an entrance animation, falling marigold petals or sparkles, and a shine.
 * Shows during the banner's IST dates for its audience; ✕ hides it for the
 * rest of the day on this browser, and a small pill brings it back.
 */

export type GreetingAudience = 'staff' | 'student' | 'associate'

interface Banner {
  id: string
  title: string
  message: string | null
  image_url: string
  effect: 'petals' | 'sparkles' | 'none'
  /** Built-in greetings draw their own picture instead of an uploaded image. */
  Scene?: () => React.JSX.Element
}

/**
 * Greetings that ship with the app, so a festival gets a banner even before
 * anyone uploads one. An uploaded banner for the same days wins.
 */
const BUILTIN_GREETINGS: (Banner & { from: string; to: string; audiences: GreetingAudience[] })[] = [
  // Chhath Puja 2026 is a whole-page theme instead (components/dashboard/ChhathTheme).
]

function builtinFor(audience: GreetingAudience, today: string): Banner | null {
  return BUILTIN_GREETINGS.find(g => g.audiences.includes(audience) && g.from <= today && today <= g.to) ?? null
}

const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
const hiddenKey = (id: string) => `dcw-greeting-hidden-${id}`

function readHidden(id: string, today: string) {
  try { return localStorage.getItem(hiddenKey(id)) === today } catch { return false }
}

export function GreetingBanner({ audience, className = '' }: { audience: GreetingAudience; className?: string }) {
  const [banner, setBanner] = useState<Banner | null>(null)
  const [hidden, setHidden] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [today] = useState(todayIST)

  useEffect(() => {
    let cancelled = false
    ;(createClient() as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- table not in generated types
      .from('greeting_banners')
      .select('id, title, message, image_url, effect')
      .eq('is_active', true)
      .contains('audiences', [audience])
      .lte('starts_on', today)
      .gte('ends_on', today)
      .order('starts_on', { ascending: false })
      .limit(1)
      .then(({ data }: { data: Banner[] | null }) => show(data?.[0] ?? builtinFor(audience, today)),
        // No table yet (migration 124 not run) or offline: the built-in one still shows
        () => show(builtinFor(audience, today)))
    function show(b: Banner | null) {
      if (cancelled || !b) return
      setBanner(b)
      setHidden(readHidden(b.id, today))
    }
    return () => { cancelled = true }
  }, [audience, today])

  // Fixed per mount so the petals don't jump on re-render.
  const particles = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: (i * 37 + 11) % 100,
    delay: (i * 0.53) % 6,
    duration: 6 + ((i * 7) % 5),
    size: 8 + ((i * 5) % 9),
    drift: ((i % 2) ? 1 : -1) * (20 + (i * 13) % 40),
    hue: i % 3,
  })), [])

  if (!banner) return null

  if (hidden) {
    return (
      <button
        onClick={() => { try { localStorage.removeItem(hiddenKey(banner.id)) } catch { /* ignore */ } setHidden(false) }}
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm hover:shadow transition ${className}`}
      >
        <PartyPopper className="w-3.5 h-3.5" /> {banner.title}
      </button>
    )
  }

  // A drawn scene is ready at once; an uploaded image once it has loaded.
  const ready = loaded || !!banner.Scene

  function hide() {
    try { localStorage.setItem(hiddenKey(banner!.id), today) } catch { /* ignore */ }
    setHidden(true)
  }

  return (
    <div className={`greeting-in relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-lg shadow-orange-200/50 ring-1 ring-amber-200/70 ${className}`}>
      {banner.Scene ? <banner.Scene /> : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded image of any size */}
          <img
            src={banner.image_url}
            alt={banner.title}
            onLoad={() => setLoaded(true)}
            className={`block w-full h-auto transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
          {!loaded && <div className="aspect-[16/7] w-full animate-pulse bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50" />}
        </>
      )}

      {/* One shine across the image after it lands */}
      {ready && <div className="greeting-shine pointer-events-none absolute inset-0" />}

      {/* Falling petals / twinkling sparkles */}
      {ready && banner.effect !== 'none' && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {particles.map((p, i) => banner.effect === 'petals' ? (
            <span
              key={i}
              className="greeting-petal absolute -top-6 rounded-[60%_0_60%_0]"
              style={{
                left: `${p.left}%`, width: p.size, height: p.size * 0.7,
                background: ['#f97316', '#fbbf24', '#f59e0b'][p.hue],
                animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
                ['--drift' as string]: `${p.drift}px`,
              }}
            />
          ) : (
            <span
              key={i}
              className="greeting-spark absolute text-amber-300"
              style={{
                left: `${p.left}%`, top: `${(i * 23 + 7) % 90}%`, fontSize: p.size + 4,
                animationDelay: `${p.delay * 0.6}s`, animationDuration: `${2 + (i % 3)}s`,
              }}
            >✦</span>
          ))}
        </div>
      )}

      {banner.message && (
        <div className="relative px-4 py-2.5 text-center text-sm font-medium text-gray-700 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border-t border-amber-100">
          {banner.message}
        </div>
      )}

      <button
        onClick={hide}
        aria-label="Hide for today"
        title="Hide for today"
        className="absolute right-2 top-2 rounded-full bg-white/80 p-1.5 text-gray-600 shadow backdrop-blur hover:bg-white hover:text-gray-900"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <style>{`
        .greeting-in { animation: greeting-in 0.8s cubic-bezier(0.2, 1.2, 0.4, 1) both; }
        @keyframes greeting-in { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
        .greeting-shine {
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 48%, transparent 66%);
          transform: translateX(-120%);
          animation: greeting-shine 1.6s 0.5s ease-out forwards;
        }
        @keyframes greeting-shine { to { transform: translateX(120%); } }
        .greeting-petal { opacity: 0; animation-name: greeting-fall; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes greeting-fall {
          0% { opacity: 0; transform: translate(0, 0) rotate(0deg); }
          10% { opacity: 0.9; }
          90% { opacity: 0.8; }
          100% { opacity: 0; transform: translate(var(--drift), 420px) rotate(540deg); }
        }
        .greeting-spark { opacity: 0; animation-name: greeting-twinkle; animation-iteration-count: infinite; animation-timing-function: ease-in-out; text-shadow: 0 0 8px rgba(251,191,36,0.9); }
        @keyframes greeting-twinkle { 0%, 100% { opacity: 0; transform: scale(0.4); } 50% { opacity: 1; transform: scale(1.1); } }
        @media (prefers-reduced-motion: reduce) {
          .greeting-in, .greeting-shine, .greeting-petal, .greeting-spark { animation: none; }
          .greeting-petal, .greeting-spark, .greeting-shine { display: none; }
        }
      `}</style>
    </div>
  )
}
